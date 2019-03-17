import flat from 'array.prototype.flat';
import {stripIndents} from 'common-tags';
import fs from 'fs';
import {depGraph} from 'google-closure-deps';
import util from 'util';
import {assertNonNullable, assertString} from './assert';
import {compile, CompilerOptions, toCompilerOptions} from './compiler';
import {Dag, Node} from './dag';
import {DuckConfig} from './duckconfig';
import {EntryConfig, loadEntryConfig} from './entryconfig';
import {getClosureLibraryDependencies, getDependencies} from './gendeps';

export async function build(config: DuckConfig) {
  const stat = await util.promisify(fs.stat)(config.entryConfigDir);
  if (stat.isDirectory()) {
    throw new Error('Compiling all files in a directory is not yet implemented');
  }
  const entryConfig = await loadEntryConfig(config.entryConfigDir);
  if (entryConfig.modules) {
    return compileChunk(entryConfig, config);
  } else {
    return compilePage(entryConfig);
  }
}

async function compilePage(entryConfig: EntryConfig) {
  const opts = toCompilerOptions(entryConfig);
  return compile(opts);
}

async function compileChunk(entryConfig: EntryConfig, config: DuckConfig) {
  const opts = await createComiplerOptionsForChunks(entryConfig, config, createModuleUris);
  return compile(opts);
}

async function createComiplerOptionsForChunks(
  entryConfig: EntryConfig,
  config: DuckConfig,
  createModuleUris: (id: string, entryConfig: EntryConfig) => string[]
): Promise<CompilerOptions> {
  // TODO: separate EntryConfigChunks from EntryConfig
  const modules = assertNonNullable(entryConfig.modules);
  const dependencies = flat(
    await Promise.all([
      getDependencies(entryConfig, config.closureLibraryDir),
      getClosureLibraryDependencies(config.closureLibraryDir),
    ])
  );
  const pathToDep: Map<string, depGraph.Dependency> = new Map(
    dependencies.map(dep => [dep.path, dep] as [string, depGraph.Dependency])
  );
  const chunkNodes: Node[] = [];
  for (const id in modules) {
    const chunk = modules[id];
    chunkNodes.push(new Node(id, chunk.deps));
  }
  const dag = new Dag(chunkNodes);
  const sortedChunkIds = dag.getSortedNodes().map(node => node.id);
  const graph = new depGraph.Graph(dependencies);
  const chunkToTransitiveDepPath: Map<string, Set<string>> = new Map();
  const allInputPathSet: Set<string> = new Set();
  sortedChunkIds.forEach(chunkId => {
    const chunkConfig = modules[chunkId];
    const entryPoints = chunkConfig.inputs.map(input =>
      assertNonNullable(
        pathToDep.get(input),
        `entryConfig.paths does not include the inputs: ${input}`
      )
    );
    const inputPaths = graph.order(...entryPoints).map(dep => dep.path);
    chunkToTransitiveDepPath.set(chunkId, new Set(inputPaths));
    inputPaths.forEach(input => allInputPathSet.add(input));
    chunkConfig.inputs.forEach(input => allInputPathSet.add(input));
  });
  const chunkToInputPath: Map<string, Set<string>> = new Map();
  sortedChunkIds.forEach(chunk => {
    chunkToInputPath.set(chunk, new Set());
  });
  for (const inputPath of allInputPathSet) {
    const chunksWithInput: string[] = [];
    chunkToTransitiveDepPath.forEach((inputs, chunk) => {
      if (inputs.has(inputPath)) {
        chunksWithInput.push(chunk);
      }
    });
    const targetChunk = dag.getLcaNode(...chunksWithInput);
    assertNonNullable(chunkToInputPath.get(targetChunk.id)).add(inputPath);
  }
  const opts = toCompilerOptions(entryConfig);
  opts.js = flat([...chunkToInputPath.values()].map(inputs => [...inputs]));
  opts.chunk = sortedChunkIds.map(id => {
    const {deps} = modules[id];
    const numOfInputs = chunkToInputPath.get(id)!.size;
    return `${id}:${numOfInputs}:${deps.join(',')}`;
  });
  const {moduleInfo, moduleUris, rootId} = convertModuleInfos(entryConfig, createModuleUris);
  const wrapper = stripIndents`var PLOVR_MODULE_INFO = ${JSON.stringify(moduleInfo)};
var PLOVR_MODULE_URIS = ${JSON.stringify(moduleUris)};
%output%`;
  opts.chunk_wrapper = [`${rootId}:${wrapper}`];
  return opts;
}

function createModuleUris(id: string, entryConfig: EntryConfig): string[] {
  const moduleProductionUri = assertString(entryConfig['module-production-uri']);
  return [moduleProductionUri.replace(/%s/g, id)];
}

function convertModuleInfos(
  entryConfig: EntryConfig,
  createModuleUris: (id: string, entryConfig: EntryConfig) => string[]
): {moduleInfo: {[id: string]: string[]}; moduleUris: {[id: string]: string[]}; rootId: string} {
  let rootId: string | null = null;
  const {modules} = entryConfig;
  const moduleInfo: {[id: string]: string[]} = {};
  const moduleUris: {[id: string]: string[]} = {};
  for (const id in modules) {
    const module = modules[id];
    moduleInfo[id] = module.deps;
    moduleUris[id] = createModuleUris(id, entryConfig);
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
  if (entryConfig.mode === 'RAW') {
    // The root chunk loads all chunks in RAW mode
    const chunkNodes: Node[] = [];
    for (const id in entryConfig.modules) {
      const chunk = entryConfig.modules[id];
      chunkNodes.push(new Node(id, chunk.deps));
    }
    const dag = new Dag(chunkNodes);
    const sortedChunkIds = dag.getSortedNodes().map(node => node.id);
    moduleUris[rootId] = flat(sortedChunkIds.map(id => moduleUris[id]));
  }
  return {moduleInfo, moduleUris, rootId};
}
