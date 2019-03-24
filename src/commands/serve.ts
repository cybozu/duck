import flat from 'array.prototype.flat';
import {stripIndents} from 'common-tags';
import cors from 'cors';
import fastify from 'fastify';
import {ServerResponse} from 'http';
import path from 'path';
import serveStatic from 'serve-static';
import {assertNonNullable, assertString} from '../assert';
import {
  CompilerOutput,
  compileToJson,
  convertModuleInfos,
  convertToFlagfile,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from '../compiler';
import {DuckConfig} from '../duckconfig';
import {createDag, EntryConfig, loadEntryConfigById, PlovrMode} from '../entryconfig';
import {generateDepFileText} from '../gendeps';
import {
  closureLibraryUrlPath,
  compileUrlPath,
  depsUrlPath,
  googBaseUrlPath,
  inputsUrlPath,
} from '../urls';

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
    const entryConfig = await loadEntryConfigById(
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
          // convert number to string
          String(request.id),
          request.query
        );
      } else {
        return replyPageCompile(reply, entryConfig);
      }
    }
  });

  function inputsToUrisForRaw(inputs: string[]): string[] {
    return inputs
      .map(input => path.relative(config.inputsRoot, input))
      .map(input => new URL(`${inputsUrlPath}/${input}`, baseUrl).toString());
  }

  function replyChunksRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    const modules = assertNonNullable(entryConfig.modules);
    const {moduleInfo, moduleUris, rootId} = convertModuleInfos(entryConfig, id => {
      return inputsToUrisForRaw(modules[id].inputs);
    });
    // The root chunk loads all chunks in RAW mode
    const sortedChunkIds = createDag(entryConfig).getSortedIds();
    moduleUris[rootId] = flat(sortedChunkIds.map(id => moduleUris[id]));
    for (const id in moduleUris) {
      if (id !== rootId) {
        moduleUris[id] = [];
      }
    }
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

  async function replyChunksCompile(
    reply: fastify.FastifyReply<ServerResponse>,
    entryConfig: EntryConfig,
    url: string,
    requestId: string,
    query: CompileQuery
  ) {
    const {parentRequest, chunk: requestedChunkId} = query;
    if (!entryIdToChunkCache.has(entryConfig.id)) {
      entryIdToChunkCache.set(entryConfig.id, new Map());
    }
    const chunkCache = entryIdToChunkCache.get(entryConfig.id)!;
    if (requestedChunkId && parentRequest && chunkCache.has(parentRequest)) {
      const parentChunkCache = chunkCache.get(parentRequest)!;
      if (!parentChunkCache[requestedChunkId]) {
        throw new Error(`Unexpected requested chunk: ${requestedChunkId}`);
      }
      return parentChunkCache[requestedChunkId].src;
    }

    function createModuleUris(chunkId: string): string[] {
      const uri = new URL(url, baseUrl);
      const params = uri.searchParams;
      params.set('chunk', chunkId);
      params.set('parentRequest', requestId);
      uri.search = params.toString();
      return [uri.toString()];
    }

    const {options, sortedChunkIds, rootChunkId} = await createCompilerOptionsForChunks(
      entryConfig,
      config,
      false,
      createModuleUris
    );
    const chunkOutputs = await compileToJson(convertToFlagfile(options));
    const chunkIdToOutput: {[id: string]: CompilerOutput} = {};
    sortedChunkIds.forEach((id, index) => {
      chunkIdToOutput[id] = chunkOutputs[index];
    });
    chunkCache.set(requestId, chunkIdToOutput);
    reply
      .code(200)
      .type('application/javascript')
      .send(chunkIdToOutput[requestedChunkId || rootChunkId].src);
  }

  const entryIdToChunkCache: Map<string, Map<string, {[id: string]: CompilerOutput}>> = new Map();

  function replyPageRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    // TODO: separate EntryConfigPage from EntryConfig
    const inputs = assertNonNullable(entryConfig.inputs);
    const uris = inputsToUrisForRaw(inputs);
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
    const options = createCompilerOptionsForPage(entryConfig, false);
    const chunkOutputs = await compileToJson(options);
    if (chunkOutputs.length !== 1) {
      throw new Error(
        `Unexpectedly chunkOutputs.length must be 1, but actual ${chunkOutputs.length}`
      );
    }
    reply
      .code(200)
      .type('application/javascript')
      .send(chunkOutputs[0].src);
  }

  server.get<CompileQuery>(depsUrlPath, opts, async (request, reply) => {
    const entryConfig = await loadEntryConfigById(
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
