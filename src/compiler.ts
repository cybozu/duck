import flat from 'array.prototype.flat';
import {stripIndents} from 'common-tags';
import fs from 'fs';
import {compiler as ClosureCompiler} from 'google-closure-compiler';
import {depGraph} from 'google-closure-deps';
import * as tempy from 'tempy';
import {assertNonNullable} from './assert';
import {Dag} from './dag';
import {DuckConfig} from './duckconfig';
import {createDag, EntryConfig, PlovrMode} from './entryconfig';
import {getClosureLibraryDependencies, getDependencies} from './gendeps';

export interface CompilerOptions {
  [idx: string]: any;
  // 'LOOSE' and 'STRICT' are deprecated. Use 'PRUNE_LEGACY' and 'PRUNE' respectedly.
  dependency_mode?: 'NONE' | 'SORT_ONLY' | 'PRUNE_LEGACY' | 'PRUNE';
  entry_point?: string[];
  compilation_level?: 'BUNDLE' | 'WHITESPACE' | 'WHITESPACE_ONLY' | 'SIMPLE' | 'ADVANCED';
  js?: string[];
  js_output_file?: string;
  // chunk (module): `name:num-js-files[:[dep,...][:]]`, ex) "chunk1:3:app"
  chunk?: string[];
  language_in?: string;
  language_out?: string;
  json_streams?: 'IN' | 'OUT' | 'BOTH';
  warning_level?: 'QUIET' | 'DEFAULT' | 'VERBOSE';
  debug?: boolean;
  formatting?: CompilerOptionsFormattingType[];
  define?: string[];
  externs?: string[];
  // chunkname:wrappercode
  chunk_wrapper?: string[];
  chunk_output_path_prefix?: string;
  isolation_mode?: 'NONE' | 'IIFE';
  jscomp_error?: string[];
  jscomp_warning?: string[];
  jscomp_off?: string[];
  flagfile?: string;
}

type CompilerOptionsFormattingType = 'PRETTY_PRINT' | 'PRINT_INPUT_DELIMITER' | 'SINGLE_QUOTES';

function createBaseOptions(entryConfig: EntryConfig, outputToFile: boolean): CompilerOptions {
  const opts: CompilerOptions = {
    json_streams: 'OUT',
  };

  function copy(entryKey: keyof EntryConfig, closureKey = entryKey.replace(/-/g, '_')) {
    if (entryKey in entryConfig) {
      opts[closureKey] = entryConfig[entryKey];
    }
  }

  copy('language-in');
  copy('language-out');
  copy('level', 'warning_level');
  copy('debug');

  if (entryConfig.mode === PlovrMode.RAW) {
    opts.compilation_level = 'WHITESPACE';
  } else {
    opts.compilation_level = entryConfig.mode;
  }

  if (entryConfig.modules) {
    // for chunks
    opts.dependency_mode = 'NONE';
    if (outputToFile) {
      if (!entryConfig['module-output-path']) {
        throw new Error('entryConfig["module-output-path"] must be specified');
      }
      const outputPath = entryConfig['module-output-path'];
      const suffix = '%s.js';
      if (!outputPath.endsWith(suffix)) {
        throw new TypeError(
          `"moduleOutputPath" must end with "${suffix}", but actual "${outputPath}"`
        );
      }
      opts.chunk_output_path_prefix = outputPath.slice(0, suffix.length * -1);
    }
  } else {
    // for pages
    opts.dependency_mode = 'PRUNE';
    opts.js = entryConfig.paths.slice();
    if (entryConfig.externs) {
      opts.js.push(...entryConfig.externs.map(extern => `!${extern}`));
    }
    opts.entry_point = assertNonNullable(entryConfig.inputs).slice();
    // TODO: consider `global-scope-name`
    opts.isolation_mode = 'IIFE';
    if (outputToFile) {
      if (!entryConfig['output-file']) {
        throw new Error('entryConfig["output-file"] must be specified');
      }
      copy('output-file', 'js_output_file');
    }
  }

  if (entryConfig.externs) {
    opts.externs = entryConfig.externs.slice();
  }

  const formatting: CompilerOptionsFormattingType[] = [];
  if (entryConfig['pretty-print']) {
    formatting.push('PRETTY_PRINT');
  }
  if (entryConfig['print-input-delimiter']) {
    formatting.push('PRINT_INPUT_DELIMITER');
  }
  if (formatting.length > 0) {
    opts.formatting = formatting;
  }

  if (entryConfig.define) {
    opts.define = Object.entries(entryConfig.define).map(([key, value]) => {
      if (typeof value === 'string') {
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
        case 'ERROR':
          jscompError.push(name);
          break;
        case 'WARNING':
          jscompWarning.push(name);
          break;
        case 'OFF':
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

/**
 * @throws If compiler throws errors
 */
export async function compileToJson(opts: CompilerOptions): Promise<CompilerOutput[]> {
  if (opts.json_streams !== 'OUT') {
    throw new Error(`json_streams must be "OUT", but actual "${opts.json_streams}"`);
  }
  const output = await compile(opts);
  return JSON.parse(output);
}

export async function compile(opts: CompilerOptions): Promise<string> {
  const compiler = new ClosureCompiler(opts as any);
  return new Promise((resolve, reject) => {
    compiler.run((exitCode: number, stdout: string, stderr?: string) => {
      if (stderr) {
        return reject(new CompilerError(stderr, exitCode));
      }
      resolve(stdout);
    });
  });
}

class CompilerError extends Error {
  exitCode: number;
  constructor(msg: string, exitCode: number) {
    super(msg);
    this.name = 'CompilerError';
    this.exitCode = exitCode;
  }
}

export function createCompilerOptionsForPage(
  entryConfig: EntryConfig,
  outputToFile: boolean
): CompilerOptions {
  return createBaseOptions(entryConfig, outputToFile);
}

export async function createCompilerOptionsForChunks(
  entryConfig: EntryConfig,
  config: DuckConfig,
  outputToFile: boolean,
  createModuleUris: (chunkId: string) => string[]
): Promise<{options: CompilerOptions; sortedChunkIds: string[]; rootChunkId: string}> {
  // TODO: separate EntryConfigChunks from EntryConfig
  const modules = assertNonNullable(entryConfig.modules);
  const dependencies = flat(
    await Promise.all([
      getDependencies(entryConfig, config.closureLibraryDir),
      getClosureLibraryDependencies(config.closureLibraryDir),
    ])
  );
  const dag = createDag(entryConfig);
  const sortedChunkIds = dag.getSortedIds();
  const chunkToTransitiveDepPathSet = findTransitiveDeps(sortedChunkIds, dependencies, modules);
  const chunkToInputPathSet = splitDepsIntoChunks(sortedChunkIds, chunkToTransitiveDepPathSet, dag);
  const opts = createBaseOptions(entryConfig, outputToFile);
  opts.js = flat([...chunkToInputPathSet.values()].map(inputs => [...inputs]));
  opts.chunk = sortedChunkIds.map(id => {
    const numOfInputs = chunkToInputPathSet.get(id)!.size;
    return `${id}:${numOfInputs}:${modules[id].deps.join(',')}`;
  });
  const {moduleInfo, moduleUris, rootId} = convertModuleInfos(entryConfig, createModuleUris);
  const wrapper = stripIndents`var PLOVR_MODULE_INFO = ${JSON.stringify(moduleInfo)};
var PLOVR_MODULE_URIS = ${JSON.stringify(moduleUris)};
%output%`.replace(/\n/g, '%n');
  opts.chunk_wrapper = [`${rootId}:${wrapper}`];
  return {options: opts, sortedChunkIds, rootChunkId: rootId};
}

function findTransitiveDeps(
  sortedChunkIds: string[],
  dependencies: depGraph.Dependency[],
  modules: {[id: string]: {inputs: string[]; deps: string[]}}
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
  sortedChunkIds: string[],
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
): {moduleInfo: {[id: string]: string[]}; moduleUris: {[id: string]: string[]}; rootId: string} {
  let rootId: string | null = null;
  const modules = assertNonNullable(entryConfig.modules);
  const moduleInfo: {[id: string]: string[]} = {};
  const moduleUris: {[id: string]: string[]} = {};
  for (const id in modules) {
    const module = modules[id];
    moduleInfo[id] = module.deps;
    moduleUris[id] = createModuleUris(id);
    if (module.deps.length === 0) {
      if (rootId) {
        throw new Error('Many root modules');
      }
      rootId = id;
    }
  }
  if (!rootId) {
    throw new Error('No root module');
  }
  return {moduleInfo, moduleUris, rootId};
}

/**
 * To avoid "spawn E2BIG" errors on a large scale project,
 * transfer compiler options via a flagfile instead of CLI arguments.
 */
export function convertToFlagfile(opts: CompilerOptions): {flagfile: string} {
  const flagfile = tempy.file({
    name: `${new Date().toISOString().replace(/[^\w]/g, '')}.closure.conf`,
  });
  const lines: string[] = [];
  Object.entries(opts).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      lines.push(...value.map(v => createKeyValue(key, v)));
    } else {
      lines.push(createKeyValue(key, value));
    }
  });
  fs.writeFileSync(flagfile, lines.join('\n'), 'utf8');
  console.debug({flagfile});
  return {flagfile};

  function createKeyValue(key: string, value: any): string {
    return `--${key} "${escape(String(value))}"`;
  }
}

/**
 * Escape for Closure Compiler flag files.
 * It handles only double-qotes, not single.
 * @see https://github.com/google/closure-compiler/blob/v20190301/src/com/google/javascript/jscomp/CommandLineRunner.java#L1500
 */
function escape(str: string): string {
  return str.replace(/"/g, '\\"');
}
