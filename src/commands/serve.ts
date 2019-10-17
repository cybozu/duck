import flat from "array.prototype.flat";
import { stripIndents } from "common-tags";
import cors from "cors";
import fastify from "fastify";
import { readFile } from "fs";
import { ServerResponse } from "http";
import path from "path";
import pino from "pino";
import serveStatic from "serve-static";
import { promisify } from "util";
import { assertNonNullable, assertString } from "../assert";
import {
  CompilerOutput,
  compileToJson,
  convertModuleInfos,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from "../compiler";
import { DuckConfig } from "../duckconfig";
import { createDag, EntryConfig, loadEntryConfigById, PlovrMode } from "../entryconfig";
import { generateDepFileText, restoreDepsJs, writeCachedDepsOnDisk } from "../gendeps";
import { logger, setGlobalLogger } from "../logger";
import {
  closureLibraryUrlPath,
  compileUrlPath,
  depsUrlPath,
  googBaseUrlPath,
  inputsUrlPath,
} from "../urls";
import { watchJsAndSoy } from "../watch";

const entryIdToChunkCache: Map<string, Map<string, { [id: string]: CompilerOutput }>> = new Map();

function getScriptBaseUrl(reply: fastify.FastifyReply<ServerResponse>, isHttps: boolean): URL {
  const { host } = reply.request.headers;
  if (typeof host !== "string") {
    throw new TypeError(`Host header of request doesn't exist: ${host}`);
  }
  const scheme = isHttps ? "https" : "http";
  return new URL(`${scheme}://${host}/`);
}

function getGoogBaseUrl(baseUrl: URL): URL {
  return new URL(googBaseUrlPath, baseUrl);
}

function getDepsUrl(baseUrl: URL, entryConfigId: string): URL {
  const depsUrl = new URL(depsUrlPath, baseUrl);
  depsUrl.searchParams.set("id", entryConfigId);
  return depsUrl;
}

export async function serve(config: DuckConfig, watch = true) {
  setGlobalLogger(
    pino({
      prettyPrint: { translateTime: "SYS:HH:MM:ss.l", ignore: "hostname,pid" },
    })
  );

  if (watch) {
    watchJsAndSoy(config);
  }

  if (config.depsJs) {
    restoreDepsJs(config.depsJs, config.closureLibraryDir).then(() =>
      logger.debug("deps.js restored", config.depsJs)
    );
  }

  const server = await createServer(config);

  // static assets
  server.use(closureLibraryUrlPath, serveStatic(config.closureLibraryDir, {
    maxAge: "1d",
    immutable: true,
  }) as any);
  server.use(inputsUrlPath, serveStatic(config.inputsRoot) as any);

  // route
  server.get("/", async (request, reply) => {
    return { hello: "world" };
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
        type: "object",
        properties: {
          id: { type: "string" },
          mode: { type: "string", enum: ["RAW", "WHITESPACE", "SIMPLE", "ADVANCED"] },
          chunk: { type: "string" },
          parentRequest: { type: "string" },
        },
        required: ["id"],
      },
    },
  };

  server.get<CompileQuery>(compileUrlPath, opts, async (request, reply) => {
    const entryConfig = await loadEntryConfigById(
      request.query.id,
      config.entryConfigDir,
      request.query
    );
    if (entryConfig.mode === "RAW") {
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
        return replyPageCompile(reply, entryConfig, config);
      }
    }
  });

  function inputsToUrisForRaw(inputs: readonly string[], baseUrl: URL): string[] {
    return inputs
      .map(input => path.relative(config.inputsRoot, input))
      .map(input => new URL(`${inputsUrlPath}/${input}`, baseUrl).toString());
  }

  function replyChunksRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    const baseUrl = getScriptBaseUrl(reply, !!config.https);
    const modules = assertNonNullable(entryConfig.modules);
    const { moduleInfo, moduleUris } = convertModuleInfos(entryConfig, id => {
      return inputsToUrisForRaw(modules[id].inputs, baseUrl);
    });
    // The root chunk loads all chunks in RAW mode
    const sortedChunkIds = createDag(entryConfig).getSortedIds();
    const rootId = sortedChunkIds[0];
    moduleUris[rootId] = flat(sortedChunkIds.map(id => moduleUris[id]));
    for (const id in moduleUris) {
      if (id !== rootId) {
        moduleUris[id] = [];
      }
    }
    const rootModuleUris = moduleUris[rootId];
    reply.code(200).type("application/javascript").send(stripIndents`
    document.write('<script src="${getGoogBaseUrl(baseUrl)}"></script>');
    document.write('<script src="${getDepsUrl(baseUrl, entryConfig.id)}"></script>');
    document.write('<script>var PLOVR_MODULE_INFO = ${JSON.stringify(moduleInfo)};</script>');
    document.write('<script>var PLOVR_MODULE_URIS = ${JSON.stringify(moduleUris)};</script>');
    document.write('<script>var PLOVR_MODULE_USE_DEBUG_MODE = ${!!entryConfig.debug};</script>');
    ${rootModuleUris
      .map(uri => `document.write('<script>goog.require("${uri}")</script>');`)
      .join("\n")}
    `);
  }

  async function replyChunksCompile(
    reply: fastify.FastifyReply<ServerResponse>,
    entryConfig: EntryConfig,
    url: string,
    requestId: string,
    query: CompileQuery
  ) {
    const { parentRequest, chunk: requestedChunkId } = query;
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
    const baseUrl = getScriptBaseUrl(reply, !!config.https);
    function createModuleUris(chunkId: string): string[] {
      const uri = new URL(url, baseUrl);
      const params = uri.searchParams;
      params.set("chunk", chunkId);
      params.set("parentRequest", requestId);
      uri.search = params.toString();
      return [uri.toString()];
    }

    const { options, sortedChunkIds, rootChunkId } = await createCompilerOptionsForChunks(
      entryConfig,
      config,
      false,
      createModuleUris
    );
    updateDepsJsCache(config);
    const chunkOutputs = await compileToJson(options);
    const chunkIdToOutput: { [id: string]: CompilerOutput } = {};
    sortedChunkIds.forEach((id, index) => {
      chunkIdToOutput[id] = chunkOutputs[index];
    });
    chunkCache.set(requestId, chunkIdToOutput);
    reply
      .code(200)
      .type("application/javascript")
      .send(chunkIdToOutput[requestedChunkId || rootChunkId].src);
  }

  function replyPageRaw(reply: fastify.FastifyReply<ServerResponse>, entryConfig: EntryConfig) {
    // TODO: separate EntryConfigPage from EntryConfig
    const inputs = assertNonNullable(entryConfig.inputs);
    const baseUrl = getScriptBaseUrl(reply, !!config.https);
    const uris = inputsToUrisForRaw(inputs, baseUrl);
    reply.code(200).type("application/javascript").send(stripIndents`
    document.write('<script src="${getGoogBaseUrl(baseUrl)}"></script>');
    document.write('<script src="${getDepsUrl(baseUrl, entryConfig.id)}"></script>');
    ${uris.map(uri => `document.write('<script>goog.require("${uri}")</script>');`).join("\n")}
  `);
  }

  async function replyPageCompile(
    reply: fastify.FastifyReply<ServerResponse>,
    entryConfig: EntryConfig,
    duckConfig: DuckConfig
  ) {
    const options = createCompilerOptionsForPage(entryConfig, duckConfig, false);
    const compileOutputs = await compileToJson(options);
    if (compileOutputs.length !== 1) {
      throw new Error(
        `Unexpectedly chunkOutputs.length must be 1, but actual ${compileOutputs.length}`
      );
    }
    reply
      .code(200)
      .type("application/javascript")
      .send(compileOutputs[0].src);
  }

  server.get<CompileQuery>(depsUrlPath, opts, async (request, reply) => {
    const entryConfig = await loadEntryConfigById(
      request.query.id,
      config.entryConfigDir,
      request.query
    );
    const depsContent = await generateDepFileText(
      entryConfig,
      config.inputsRoot,
      config.depsJsIgnoreDirs.concat(config.closureLibraryDir),
      config.depsWorkers
    );
    reply
      .code(200)
      .type("application/javascript")
      .send(depsContent);
    updateDepsJsCache(config);
  });

  // start server
  const start = async () => {
    const { host, port } = config;
    try {
      await server.listen(port, host);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  start();
}

function updateDepsJsCache(config: DuckConfig) {
  const { depsJs } = config;
  if (depsJs) {
    writeCachedDepsOnDisk(depsJs, config.closureLibraryDir).then(
      () => logger.debug(`[DEPSJS_UPDATED]: ${path.relative(process.cwd(), depsJs)}`),
      err => logger.error({ err }, "Fail to write deps.js")
    );
  }
}

async function createServer(config: DuckConfig): Promise<fastify.FastifyInstance> {
  const opts: fastify.ServerOptions = {
    logger,
    disableRequestLogging: true,
  };
  const { http2, https } = config;
  // `req.originalUrl` is added by fastify but doesn't exist in the type definition.
  // https://github.com/fastify/fastify/blob/ecea232ae596fd0eb06a5b38080e19e4414bd942/lib/route.js#L285
  type FastifyIncomingMessage = import("http").IncomingMessage & { originalUrl?: string };
  let server: fastify.FastifyInstance<import("http").Server, FastifyIncomingMessage>;
  if (https) {
    const httpsOptions = {
      key: await promisify(readFile)(https.keyPath, "utf8"),
      cert: await promisify(readFile)(https.certPath, "utf8"),
    };
    // Use `any` because the types of http, https and http2 modules in Node.js are not compatible.
    // But it is not a big deal.
    if (http2) {
      server = fastify({
        ...opts,
        https: httpsOptions,
        http2: true,
      }) as fastify.FastifyInstance<any, any, any>;
    } else {
      server = fastify({ ...opts, https: httpsOptions }) as any;
    }
  } else {
    server = fastify(opts);
  }

  // enable CORS at first
  server.use(cors());

  // customize log output
  server.addHook("onRequest", async ({ raw, log }, reply) => {
    const { method, url } = raw;
    if (url && url.startsWith(inputsUrlPath)) {
      // skip logging for static assets
      return;
    }
    log.info({ request: `${method} ${url}` }, "incoming request");
  });
  server.addHook("onResponse", async ({ raw, log }, reply) => {
    const { method, url, originalUrl } = raw;
    if (originalUrl && originalUrl.startsWith(inputsUrlPath)) {
      // skip logging for static assets
      return;
    }
    log.info(
      {
        request: `${method} ${originalUrl || url || '"N/A"'}`,
        statusCode: reply.res.statusCode,
        responseTime: `${Math.round(reply.getResponseTime())}ms`,
      },
      "request completed"
    );
  });
  return server;
}

/**
 * Clear all compiled chunks
 */
export function clearEntryIdToChunkCache() {
  entryIdToChunkCache.clear();
}
