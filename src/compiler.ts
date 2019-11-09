import flat from "array.prototype.flat";
import { stripIndents } from "common-tags";
import { depGraph } from "google-closure-deps";
import path from "path";
import { assertNonNullable } from "./assert";
import {
  CompilationLevel,
  CompilerOptions,
  CompilerOptionsFormattingType,
  ExtendedCompilerOptions,
} from "./compiler-core";
import { Dag } from "./dag";
import { DuckConfig } from "./duckconfig";
import { createDag, EntryConfig, PlovrMode, WarningsWhitelistItem } from "./entryconfig";
import { getClosureLibraryDependencies, getDependencies } from "./gendeps";

export { CompilerError, CompilerOptions, compileToJson, convertToFlagfile } from "./compiler-core";

/**
 * Used for `rename_prefix_namespace` if `global-scope-name` is enabled in entry config.
 * @see https://github.com/bolinfest/plovr/blob/v8.0.0/src/org/plovr/Config.java#L81-L93
 */
const GLOBAL_NAMESPACE = "z";

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`);
}

function createBaseOptions(
  entryConfig: EntryConfig,
  duckConfig: DuckConfig,
  outputToFile: boolean
): CompilerOptions {
  const opts: CompilerOptions = {};
  if (entryConfig["experimental-compiler-options"]) {
    const expOpts = entryConfig["experimental-compiler-options"];
    for (const key in expOpts) {
      opts[snakeCase(key)] = expOpts[key];
    }
  }

  if (!outputToFile) {
    opts.json_streams = "OUT";
  }

  function copy(entryKey: keyof EntryConfig, closureKey = entryKey.replace(/-/g, "_")) {
    if (entryKey in entryConfig) {
      opts[closureKey] = entryConfig[entryKey];
    }
  }

  copy("language-in");
  copy("language-out");
  copy("level", "warning_level");
  copy("debug");

  if (entryConfig["global-scope-name"]) {
    opts.rename_prefix_namespace = GLOBAL_NAMESPACE;
  }

  if (entryConfig.mode === PlovrMode.RAW) {
    opts.compilation_level = "WHITESPACE";
  } else {
    opts.compilation_level = entryConfig.mode;
  }

  if (entryConfig.modules) {
    // for chunks
    opts.dependency_mode = "NONE";
    if (outputToFile) {
      if (!entryConfig["module-output-path"]) {
        throw new Error('entryConfig["module-output-path"] must be specified');
      }
      const outputPath = entryConfig["module-output-path"];
      const suffix = "%s.js";
      if (!outputPath.endsWith(suffix)) {
        throw new TypeError(
          `"moduleOutputPath" must end with "${suffix}", but actual "${outputPath}"`
        );
      }
      opts.module_output_path_prefix = outputPath.slice(0, suffix.length * -1);
    }
  } else {
    // for pages
    // `STRICT` is deprecated in google-closure-compiler@20181205.
    // TODO: use `PRUNE` instead and drop support earlier than v20181205.
    opts.dependency_mode = "STRICT";
    const js = entryConfig.paths.slice();
    if (entryConfig.externs) {
      js.push(...entryConfig.externs.map(extern => `!${extern}`));
    }
    opts.js = js;
    opts.entry_point = assertNonNullable(entryConfig.inputs).slice();
    if (outputToFile) {
      if (!entryConfig["output-file"]) {
        throw new Error('entryConfig["output-file"] must be specified');
      }
      copy("output-file", "js_output_file");
    }
  }

  if (entryConfig.externs) {
    opts.externs = entryConfig.externs.slice();
  }

  const formatting: CompilerOptionsFormattingType[] = [];
  if (entryConfig["pretty-print"]) {
    formatting.push("PRETTY_PRINT");
  }
  if (entryConfig["print-input-delimiter"]) {
    formatting.push("PRINT_INPUT_DELIMITER");
  }
  if (formatting.length > 0) {
    opts.formatting = formatting;
  }

  if (entryConfig.define) {
    opts.define = Object.entries(entryConfig.define).map(([key, value]) => {
      if (typeof value === "string") {
        if (value.includes("'")) {
          throw new Error(`define value should not include single-quote: "${key}: ${value}"`);
        }
        value = `'${value}'`;
      }
      return `${key}=${value}`;
    });
  }

  if (entryConfig.checks) {
    const jscompError: string[] = [];
    const jscompWarning: string[] = [];
    const jscompOff: string[] = [];
    Object.entries(entryConfig.checks).forEach(([name, value]) => {
      switch (value) {
        case "ERROR":
          jscompError.push(name);
          break;
        case "WARNING":
          jscompWarning.push(name);
          break;
        case "OFF":
          jscompOff.push(name);
          break;
        default:
          throw new Error(`Unexpected value: "${name}: ${value}"`);
      }
    });
    if (jscompError.length > 0) {
      opts.jscomp_error = jscompError;
    }
    if (jscompWarning.length > 0) {
      opts.jscomp_warning = jscompWarning;
    }
    if (jscompOff.length > 0) {
      opts.jscomp_off = jscompOff;
    }
  }

  if (duckConfig.batch === "aws") {
    convertCompilerOptionsToRelative(opts);
  }

  return opts;
}

export interface CompilerOutput {
  path: string;
  src: string;
  source_map: string;
}

export function createCompilerOptionsForPage(
  entryConfig: EntryConfig,
  duckConfig: DuckConfig,
  outputToFile: boolean
): ExtendedCompilerOptions {
  const compilerOptions = createBaseOptions(entryConfig, duckConfig, outputToFile);
  const wrapper = createOutputWrapper(
    entryConfig,
    assertNonNullable(compilerOptions.compilation_level)
  );
  if (wrapper && wrapper !== wrapperMarker) {
    compilerOptions.output_wrapper = wrapper;
  }
  const extendedOpts: ExtendedCompilerOptions = { compilerOptions };
  if (entryConfig.warningsWhitelist) {
    extendedOpts.warningsWhitelist = createWarningsWhitelist(
      entryConfig.warningsWhitelist,
      duckConfig
    );
  }
  if (duckConfig.batch) {
    extendedOpts.batch = duckConfig.batch;
  }
  if (duckConfig.strict) {
    extendedOpts.strict = duckConfig.strict;
  }
  return extendedOpts;
}

export async function createCompilerOptionsForChunks(
  entryConfig: EntryConfig,
  duckConfig: DuckConfig,
  outputToFile: boolean,
  createModuleUris: (chunkId: string) => string[]
): Promise<{ options: ExtendedCompilerOptions; sortedChunkIds: string[]; rootChunkId: string }> {
  // TODO: separate EntryConfigChunks from EntryConfig
  const modules = assertNonNullable(entryConfig.modules);
  const ignoreDirs = duckConfig.depsJsIgnoreDirs.concat(duckConfig.closureLibraryDir);
  const dependencies = flat(
    await Promise.all([
      getDependencies(entryConfig, ignoreDirs, duckConfig.depsWorkers),
      getClosureLibraryDependencies(duckConfig.closureLibraryDir),
    ])
  );
  const dag = createDag(entryConfig);
  const sortedChunkIds = dag.getSortedIds();
  const chunkToTransitiveDepPathSet = findTransitiveDeps(sortedChunkIds, dependencies, modules);
  const chunkToInputPathSet = splitDepsIntoChunks(sortedChunkIds, chunkToTransitiveDepPathSet, dag);
  const compilerOptions = createBaseOptions(entryConfig, duckConfig, outputToFile);
  compilerOptions.js = flat([...chunkToInputPathSet.values()].map(inputs => [...inputs]));
  compilerOptions.module = sortedChunkIds.map(id => {
    const numOfInputs = chunkToInputPathSet.get(id)!.size;
    return `${id}:${numOfInputs}:${modules[id].deps.join(",")}`;
  });
  compilerOptions.module_wrapper = createChunkWrapper(
    entryConfig,
    sortedChunkIds,
    assertNonNullable(compilerOptions.compilation_level),
    createModuleUris
  );
  if (duckConfig.batch === "aws") {
    convertCompilerOptionsToRelative(compilerOptions);
  }

  const options: ExtendedCompilerOptions = {
    compilerOptions,
  };
  if (entryConfig.warningsWhitelist) {
    options.warningsWhitelist = createWarningsWhitelist(entryConfig.warningsWhitelist, duckConfig);
  }
  if (duckConfig.batch) {
    options.batch = duckConfig.batch;
  }
  if (duckConfig.strict) {
    options.strict = duckConfig.strict;
  }
  return { options, sortedChunkIds, rootChunkId: sortedChunkIds[0] };
}

const wrapperMarker = "%output%";

function createOutputWrapper(entryConfig: EntryConfig, level: CompilationLevel): string {
  // output_wrapper doesn't support "%n%"
  return createBaseOutputWrapper(entryConfig, level, true).replace(/\n+/g, "");
}

function createChunkWrapper(
  entryConfig: EntryConfig,
  sortedChunkIds: readonly string[],
  compilationLevel: CompilationLevel,
  createModuleUris: (id: string) => string[]
): string[] {
  const { moduleInfo, moduleUris } = convertModuleInfos(entryConfig, createModuleUris);
  return sortedChunkIds.map((chunkId, index) => {
    const isRootChunk = index === 0;
    let wrapper = createBaseOutputWrapper(entryConfig, compilationLevel, isRootChunk);
    if (isRootChunk) {
      wrapper = stripIndents`
      var PLOVR_MODULE_INFO=${JSON.stringify(moduleInfo)};
      var PLOVR_MODULE_URIS=${JSON.stringify(moduleUris)};
      ${entryConfig.debug ? "var PLOVR_MODULE_USE_DEBUG_MODE=true;" : ""}
      ${wrapper}`;
    }
    // chunk_wrapper supports "%n%"
    return `${chunkId}:${wrapper.replace(/\n+/g, "%n%")}`;
  });
}

/**
 * @return A base wrapper including "\n". Replace them before use.
 */
function createBaseOutputWrapper(
  entryConfig: EntryConfig,
  level: CompilationLevel,
  isRoot: boolean
): string {
  let wrapper = wrapperMarker;
  if (entryConfig["output-wrapper"]) {
    wrapper = entryConfig["output-wrapper"];
  }
  if (entryConfig["global-scope-name"] && level !== "WHITESPACE") {
    const globalScope = entryConfig["global-scope-name"];
    const globalScopeWrapper = stripIndents`
        ${isRoot ? `var ${globalScope}={};` : ""}
        (function(${GLOBAL_NAMESPACE}){
        ${wrapperMarker}
        }).call(this,${globalScope});`;
    wrapper = wrapper.replace(wrapperMarker, globalScopeWrapper);
  }
  return wrapper;
}

function findTransitiveDeps(
  sortedChunkIds: readonly string[],
  dependencies: readonly depGraph.Dependency[],
  modules: { [id: string]: { inputs: readonly string[]; deps: readonly string[] } }
): Map<string, Set<string>> {
  const pathToDep = new Map(
    dependencies.map(dep => [dep.path, dep] as [string, depGraph.Dependency])
  );
  const graph = new depGraph.Graph(dependencies);
  const chunkToTransitiveDepPathSet: Map<string, Set<string>> = new Map();
  sortedChunkIds.forEach(chunkId => {
    const chunkConfig = modules[chunkId];
    const entryPoints = chunkConfig.inputs.map(input =>
      assertNonNullable(
        pathToDep.get(input),
        `entryConfig.paths does not include the inputs: ${input}`
      )
    );
    const depPaths = graph.order(...entryPoints).map(dep => dep.path);
    chunkToTransitiveDepPathSet.set(chunkId, new Set(depPaths));
  });
  return chunkToTransitiveDepPathSet;
}

/**
 * @return a map of chunkId to a set of transitive dependencies
 */
function splitDepsIntoChunks(
  sortedChunkIds: readonly string[],
  chunkToTransitiveDepPathSet: Map<string, Set<string>>,
  dag: Dag
): Map<string, Set<string>> {
  const chunkToInputPathSet: Map<string, Set<string>> = new Map();
  sortedChunkIds.forEach(chunk => {
    chunkToInputPathSet.set(chunk, new Set());
  });
  for (const targetDepPathSet of chunkToTransitiveDepPathSet.values()) {
    for (const targetDepPath of targetDepPathSet) {
      const chunkIdsWithDep: string[] = [];
      chunkToTransitiveDepPathSet.forEach((depPathSet, chunkId) => {
        if (depPathSet.has(targetDepPath)) {
          chunkIdsWithDep.push(chunkId);
        }
      });
      const targetChunk = dag.getLcaNode(...chunkIdsWithDep);
      assertNonNullable(chunkToInputPathSet.get(targetChunk.id)).add(targetDepPath);
    }
  }
  return chunkToInputPathSet;
}

export function convertModuleInfos(
  entryConfig: EntryConfig,
  createModuleUris: (id: string) => string[]
): { moduleInfo: { [id: string]: string[] }; moduleUris: { [id: string]: string[] } } {
  const modules = assertNonNullable(entryConfig.modules);
  const moduleInfo: { [id: string]: string[] } = {};
  const moduleUris: { [id: string]: string[] } = {};
  for (const id in modules) {
    const module = modules[id];
    moduleInfo[id] = module.deps.slice();
    moduleUris[id] = createModuleUris(id);
  }
  return { moduleInfo, moduleUris };
}

function createWarningsWhitelist(
  warningsWhitelist: WarningsWhitelistItem[],
  duckConfig: DuckConfig,
  basepath: string = process.cwd()
): WarningsWhitelistItem[] {
  return warningsWhitelist.map(item => {
    const newItem = { ...item };
    if (duckConfig.batch === "aws") {
      newItem.file = path.relative(basepath, item.file);
    }
    return newItem;
  });
}

function convertCompilerOptionsToRelative(
  options: CompilerOptions,
  basepath: string = process.cwd()
): void {
  if (options.js) {
    options.js = options.js.map(file => {
      if (file.startsWith("!")) {
        return `!${path.relative(basepath, file.slice(1))}`;
      } else {
        return path.relative(basepath, file);
      }
    });
  }
  if (options.externs) {
    options.externs = options.externs.map(file => path.relative(basepath, file));
  }
  if (options.entry_point) {
    options.entry_point = options.entry_point.map(file => path.relative(basepath, file));
  }
}
