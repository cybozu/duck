import flat from 'array.prototype.flat';
import {stripIndents} from 'common-tags';
import cors from 'cors';
import fastify from 'fastify';
import {depGraph} from 'google-closure-deps';
import {ServerResponse} from 'http';
import path from 'path';
import serveStatic from 'serve-static';
import {compile, toCompilerOptions} from './compiler';
import {Dag, Node} from './dag';
import {EntryConfig, PlovrMode, loadEntryConfig} from './entryconfig';
import {generateDepFileText, getDependencies, getClosureLibraryDependencies} from './gendeps';
import {assertString, assertNonNullable, assertNodeVersionGte} from './assert';
import {
  closureLibraryUrlPath,
  inputsUrlPath,
  compileUrlPath,
  depsUrlPath,
  googBaseUrlPath,
} from './urls';
import {DuckConfig} from './duckconfig';

assertNodeVersionGte(process.version, 10);

export function serve(config: DuckConfig) {
  const PORT = config.port;
  const HOST = config.host;
  const baseUrl = new URL(`http://${HOST}:${PORT}/`);
  const googBaseUrl = new URL(googBaseUrlPath, baseUrl);
  const depsUrlBase = new URL(depsUrlPath, baseUrl);

  const server = fastify({logger: {prettyPrint: true}});

  // enable CORS at first
  server.use(cors());

  // static assets
  server.use(closureLibraryUrlPath, serveStatic(config.closureLibraryDir, {
    maxAge: '1d',
    immutable: true,
  }) as any);
  server.use(inputsUrlPath, serveStatic(config.inputsRoot) as any);

  // route
  server.get('/', async (request, reply) => {
    return {hello: 'world'};
  });

  interface CompileQuery {
    id: string;
    mode?: PlovrMode;
    chunk?: string;
    parentRequest?: string;
  }

  const opts = {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          id: {type: 'string'},
          mode: {type: 'string', enum: ['RAW', 'WHITESPACE', 'SIMPLE', 'ADVANCED']},
          chunk: {type: 'string'},
          parentRequest: {type: 'string'},
        },
        required: ['id'],
      },
    },
  };

  server.get<CompileQuery>(compileUrlPath, opts, async (request, reply) => {
    const entryConfig = await loadEntryConfig(
      request.query.id,
      config.entryConfigDir,
      request.query
    );
    if (entryConfig.mode === 'RAW') {
      if (entryConfig.modules) {
        return replyChunksRaw(reply, entryConfig);
      } else {
        return replyPageRaw(reply, entryConfig);
      }
    } else {
      if (entryConfig.modules) {
        return replyChunksCompile(
          reply,
          entryConfig,
          assertString(request.raw.url),
          String(request.id),
          request.query
        );
      } else {
        return replyPageCompile(reply, entryConfig);
      }
    }
  });

  function inputsToUrisForRaw(inputs: string[]): URL[] {
    return inputs
      .map(input => path.relative(config.inputsRoot, input))
      .map(input => new URL(`${inputsUrlPath}/${input}`, baseUrl));
  }

  function convertModuleInfos(
    entryConfig: EntryConfig,
    url?: string,
    requestId?: string
  ): {moduleInfo: {[id: string]: string[]}; moduleUris: {[id: string]: URL[]}; rootId: string} {
    let rootId: string | null = null;
    const {modules} = entryConfig;
    const moduleInfo: {[id: string]: string[]} = {};
    const moduleUris: {[id: string]: URL[]} = {};
    for (const id in modules) {
      const module = modules[id];
      moduleInfo[id] = module.deps;
      if (entryConfig.mode === 'RAW') {
        moduleUris[id] = inputsToUrisForRaw(module.inputs);
      } else {
        if (!url) {
          throw new Error(`url is not defined: ${url}`);
        }
        if (!requestId) {
          throw new Error(`requestId is not defined: ${requestId}`);
        }
        const uri = new URL(url, baseUrl);
        const params = uri.searchParams;
        params.set('chunk', id);
        params.set('parentRequest', requestId);
        uri.search = params.toString();
        moduleUris[id] = [uri];
      }
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

  function replyChunksRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    const {moduleInfo, moduleUris, rootId} = convertModuleInfos(entryConfig);
    const rootModuleUris = moduleUris[rootId];
    const depsUrl = new URL(depsUrlBase.toString());
    depsUrl.search = `id=${entryConfig.id}`;
    reply.code(200).type('application/javascript').send(stripIndents`
    document.write('<script src="${googBaseUrl}"></script>');
    document.write('<script src="${depsUrl}"></script>');
    document.write('<script>goog.global.PLOVR_MODULE_INFO = ${JSON.stringify(
      moduleInfo
    )}</script>');
    document.write('<script>goog.global.PLOVR_MODULE_URIS = ${JSON.stringify(
      moduleUris
    )}</script>');
    ${rootModuleUris
      .map(uri => `document.write('<script>goog.require("${uri}")</script>');`)
      .join('\n')}
    `);
  }

  interface ChunkOutput {
    path: string;
    src: string;
    source_map: string;
  }

  async function replyChunksCompile(
    reply: fastify.FastifyReply<ServerResponse>,
    entryConfig: EntryConfig,
    url: string,
    requestId: string,
    query: CompileQuery
  ) {
    let requestedChunkId: string | undefined = query.chunk;
    const {parentRequest} = query;
    // TODO: separate EntryConfigChunks from EntryConfig
    entryConfig.modules = assertNonNullable(entryConfig.modules);
    if (!entryIdToChunkCache.has(entryConfig.id)) {
      entryIdToChunkCache.set(entryConfig.id, new Map());
    }
    const chunkCache = entryIdToChunkCache.get(entryConfig.id)!;
    if (requestedChunkId && parentRequest && chunkCache.has(parentRequest)) {
      const parentChunkCache = chunkCache.get(parentRequest)!;
      if (!parentChunkCache[requestedChunkId]) {
        throw new Error(`Unexpected requested chunk: ${requestedChunkId}`);
      }
      return chunkCache.get(parentRequest)![requestedChunkId].src;
    }
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
    for (const id in entryConfig.modules) {
      const chunk = entryConfig.modules[id];
      chunkNodes.push(new Node(id, chunk.deps));
    }
    const dag = new Dag(chunkNodes);
    const sortedChunkIds = dag.getSortedNodes().map(node => node.id);
    const graph = new depGraph.Graph(dependencies);
    const chunkToTransitiveDepPath: Map<string, Set<string>> = new Map();
    const allInputPathSet: Set<string> = new Set();
    sortedChunkIds.forEach(chunkId => {
      const chunkConfig = entryConfig.modules![chunkId];
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
      const {deps} = entryConfig.modules![id];
      const numOfInputs = chunkToInputPath.get(id)!.size;
      return `${id}:${numOfInputs}:${deps.join(',')}`;
    });
    const {moduleInfo, moduleUris, rootId} = convertModuleInfos(entryConfig, url, requestId);
    if (!requestedChunkId) {
      requestedChunkId = rootId;
    }
    const wrapper = stripIndents`var PLOVR_MODULE_INFO = ${JSON.stringify(moduleInfo)};
  var PLOVR_MODULE_URIS = ${JSON.stringify(moduleUris)};
  %output%`;
    opts.chunk_wrapper = [`${rootId}:${wrapper}`];
    const chunkOutputs: ChunkOutput[] = JSON.parse(await compile(opts));
    const chunkIdToOutput: {[id: string]: ChunkOutput} = {};
    sortedChunkIds.forEach((id, index) => {
      chunkIdToOutput[id] = chunkOutputs[index];
    });
    chunkCache.set(requestId, chunkIdToOutput);
    reply
      .code(200)
      .type('application/javascript')
      .send(chunkIdToOutput[requestedChunkId].src);
  }

  const entryIdToChunkCache: Map<string, Map<string, {[id: string]: ChunkOutput}>> = new Map();

  function replyPageRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    // TODO: separate EntryConfigPage from EntryConfig
    entryConfig.inputs = assertNonNullable(entryConfig.inputs);
    const uris = inputsToUrisForRaw(entryConfig.inputs);
    const depsUrl = new URL(depsUrlBase.toString());
    depsUrl.search = `id=${entryConfig.id}`;
    reply.code(200).type('application/javascript').send(stripIndents`
    document.write('<script src="${googBaseUrl}"></script>');
    document.write('<script src="${depsUrl}"></script>');
    ${uris.map(uri => `document.write('<script>goog.require("${uri}")</script>');`).join('\n')}
  `);
  }

  async function replyPageCompile(
    reply: fastify.FastifyReply<ServerResponse>,
    entryConfig: EntryConfig
  ) {
    const opts = toCompilerOptions(entryConfig);
    const output = await compile(opts);
    reply
      .code(200)
      .type('application/javascript')
      .send(output);
  }

  server.get<CompileQuery>(depsUrlPath, opts, async (request, reply) => {
    const entryConfig = await loadEntryConfig(
      request.query.id,
      config.entryConfigDir,
      request.query
    );
    const depsContent = await generateDepFileText(
      entryConfig,
      config.closureLibraryDir,
      config.inputsRoot
    );
    reply
      .code(200)
      .type('application/javascript')
      .send(depsContent);
  });

  // start server
  const start = async () => {
    try {
      await server.listen(PORT, HOST);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  start();
}
