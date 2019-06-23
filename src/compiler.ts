import flat from "array.prototype.flat";
import { stripIndents } from "common-tags";
import { depGraph } from "google-closure-deps";
import { assertNonNullable } from "./assert";
import { CompilationLevel, CompilerOptions, CompilerOptionsFormattingType } from "./compiler-core";
import { Dag } from "./dag";
import { DuckConfig } from "./duckconfig";
import { createDag, EntryConfig, PlovrMode } from "./entryconfig";
import { getClosureLibraryDependencies, getDependencies } from "./gendeps";

export { compile, CompilerOptions, compileToJson, convertToFlagfile } from "./compiler-core";

/**
 * Used for `rename_prefix_namespace` if `global-scope-name` is enabled in entry config.
 * @see https://github.com/bolinfest/plovr/blob/v8.0.0/src/org/plovr/Config.java#L81-L93
 */
const GLOBAL_NAMESPACE = "z";

function createBaseOptions(entryConfig: EntryConfig, outputToFile: boolean): CompilerOptions {
  const opts: CompilerOptions = {};
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
      opts.chunk_output_path_prefix = outputPath.slice(0, suffix.length * -1);
    }
  } else {
    // for pages
    opts.dependency_mode = "PRUNE";
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

  return opts;
}

export interface CompilerOutput {
  path: string;
  src: string;
  source_map: string;
}

export function createCompilerOptionsForPage(
  entryConfig: EntryConfig,
  outputToFile: boolean
): CompilerOptions {
  const opts = createBaseOptions(entryConfig, outputToFile);
  const wrapper = createOutputWrapper(entryConfig, assertNonNullable(opts.compilation_level));
  if (wrapper && wrapper !== wrapperMarker) {
    opts.output_wrapper = wrapper;
  }
  return opts;
}

export async function createCompilerOptionsForChunks(
  entryConfig: EntryConfig,
  config: DuckConfig,
  outputToFile: boolean,
  createModuleUris: (chunkId: string) => string[]
): Promise<{ options: CompilerOptions; sortedChunkIds: string[]; rootChunkId: string }> {
  // TODO: separate EntryConfigChunks from EntryConfig
  const modules = assertNonNullable(entryConfig.modules);
  const ignoreDirs = config.depsJsIgnoreDirs.concat(config.closureLibraryDir);
  const dependencies = flat(
    await Promise.all([
      getDependencies(entryConfig, ignoreDirs, config.depsWorkers),
      getClosureLibraryDependencies(config.closureLibraryDir),
    ])
  );
  const dag = createDag(entryConfig);
  const sortedChunkIds = dag.getSortedIds();
  const chunkToTransitiveDepPathSet = findTransitiveDeps(sortedChunkIds, dependencies, modules);
  const chunkToInputPathSet = splitDepsIntoChunks(sortedChunkIds, chunkToTransitiveDepPathSet, dag);
  const options = createBaseOptions(entryConfig, outputToFile);
  options.js = flat([...chunkToInputPathSet.values()].map(inputs => [...inputs]));
  options.chunk = sortedChunkIds.map(id => {
    const numOfInputs = chunkToInputPathSet.get(id)!.size;
    return `${id}:${numOfInputs}:${modules[id].deps.join(",")}`;
  });
  options.chunk_wrapper = createChunkWrapper(
    entryConfig,
    sortedChunkIds,
    assertNonNullable(options.compilation_level),
    createModuleUris
  );
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

function splitDepsIntoChunks(
  sortedChunkIds: readonly string[],
  chunkToTransitiveDepPathSet: Map<string, Set<string>>,
  dag: Dag
) {
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
