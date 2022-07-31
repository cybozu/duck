import cors from "@fastify/cors";
import serveStatic from "@fastify/static";
import { stripIndents } from "common-tags";
import fastify, { FastifyInstance, FastifyReply } from "fastify";
import { promises as fs } from "fs";
import type http2 from "http2";
import path from "path";
import pino from "pino";
import { assertNonNullable, assertString } from "../assert";
import {
  CompilerOutput,
  compileToJson,
  convertModuleInfos,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from "../compiler";
import { DuckConfig } from "../duckconfig";
import {
  createDag,
  EntryConfig,
  loadEntryConfigById,
  PlovrMode,
} from "../entryconfig";
import {
  generateDepFileText,
  restoreDepsJs,
  writeCachedDepsOnDisk,
} from "../gendeps";
import { logger, setGlobalLogger } from "../logger";
import {
  closureLibraryUrlPath,
  compileUrlPath,
  depsUrlPath,
  googBaseUrlPath,
  inputsUrlPath,
} from "../urls";
import { watchJsAndSoy } from "../watch";

const entryIdToChunkCache: Map<
  string,
  Map<string, { [id: string]: CompilerOutput }>
> = new Map();

function getScriptBaseUrl(reply: FastifyReply, isHttps: boolean): URL {
  const { hostname } = reply.request;
  const scheme = isHttps ? "https" : "http";
  return new URL(`${scheme}://${hostname}/`);
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
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "hostname,pid",
        },
      },
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
  server.register(serveStatic, {
    root: config.closureLibraryDir,
    prefix: closureLibraryUrlPath,
    maxAge: "1d",
    immutable: true,
  });
  server.register(serveStatic, {
    root: config.inputsRoot,
    prefix: inputsUrlPath,
    decorateReply: false,
  });

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
          mode: {
            type: "string",
            enum: ["RAW", "WHITESPACE", "SIMPLE", "ADVANCED"],
          },
          chunk: { type: "string" },
          parentRequest: { type: "string" },
        },
        required: ["id"],
      },
    },
  };

  server.get<{ Querystring: CompileQuery }>(
    compileUrlPath,
    opts,
    async (request, reply) => {
      const entryConfig = await loadEntryConfigById(
        request.query.id,
        config.entryConfigDir,
        request.query
      );
      if (entryConfig.mode === "RAW") {
        if (entryConfig.modules) {
          return replyChunksRaw(reply, entryConfig);
        }
        return replyPageRaw(reply, entryConfig);
      }
      if (entryConfig.modules) {
        return replyChunksCompile(
          reply,
          entryConfig,
          assertString(request.raw.url),
          // convert number to string
          String(request.id),
          request.query
        );
      }
      return replyPageCompile(reply, entryConfig, config);
    }
  );

  function inputsToUrisForRaw(
    inputs: readonly string[],
    baseUrl: URL
  ): string[] {
    return inputs
      .map((input) => path.relative(config.inputsRoot, input))
      .map((input) => new URL(`${inputsUrlPath}/${input}`, baseUrl).toString());
  }

  function replyChunksRaw(reply: FastifyReply, entryConfig: EntryConfig) {
    const baseUrl = getScriptBaseUrl(reply, !!config.https);
    const modules = assertNonNullable(entryConfig.modules);
    const { moduleInfo, moduleUris } = convertModuleInfos(entryConfig, (id) => {
      return inputsToUrisForRaw(modules[id].inputs, baseUrl);
    });
    // The root chunk loads all chunks in RAW mode
    const sortedChunkIds = createDag(entryConfig).getSortedIds();
    const rootId = sortedChunkIds[0];
    moduleUris[rootId] = sortedChunkIds.map((id) => moduleUris[id]).flat();
    for (const id in moduleUris) {
      if (id !== rootId) {
        moduleUris[id] = [];
      }
    }
    const rootModuleUris = moduleUris[rootId];
    reply.code(200).type("application/javascript").send(stripIndents`
    document.write('<script src="${getGoogBaseUrl(baseUrl)}"></script>');
    document.write('<script src="${getDepsUrl(
      baseUrl,
      entryConfig.id
    )}"></script>');
    document.write('<script>var PLOVR_MODULE_INFO = ${JSON.stringify(
      moduleInfo
    )};</script>');
    document.write('<script>var PLOVR_MODULE_URIS = ${JSON.stringify(
      moduleUris
    )};</script>');
    document.write('<script>var PLOVR_MODULE_USE_DEBUG_MODE = ${!!entryConfig.debug};</script>');
    ${rootModuleUris
      .map(
        (uri) => `document.write('<script>goog.require("${uri}")</script>');`
      )
      .join("\n")}
    `);
  }

  async function replyChunksCompile(
    reply: FastifyReply,
    entryConfig: EntryConfig,
    url: string,
    requestId: string,
    query: CompileQuery
  ) {
    const { parentRequest, chunk: requestedChunkId } = query;
    if (!entryIdToChunkCache.has(entryConfig.id)) {
      entryIdToChunkCache.set(entryConfig.id, new Map());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const chunkCache = entryIdToChunkCache.get(entryConfig.id)!;
    if (requestedChunkId && parentRequest && chunkCache.has(parentRequest)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

    const { options, sortedChunkIds, rootChunkId } =
      await createCompilerOptionsForChunks(
        entryConfig,
        config,
        false,
        createModuleUris
      );
    updateDepsJsCache(config);
    const [chunkOutputs] = await compileToJson(options);
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

  function replyPageRaw(reply: FastifyReply, entryConfig: EntryConfig) {
    // TODO: separate EntryConfigPage from EntryConfig
    const inputs = assertNonNullable(entryConfig.inputs);
    const baseUrl = getScriptBaseUrl(reply, !!config.https);
    const uris = inputsToUrisForRaw(inputs, baseUrl);
    reply.code(200).type("application/javascript").send(stripIndents`
    document.write('<script src="${getGoogBaseUrl(baseUrl)}"></script>');
    document.write('<script src="${getDepsUrl(
      baseUrl,
      entryConfig.id
    )}"></script>');
    ${uris
      .map(
        (uri) => `document.write('<script>goog.require("${uri}")</script>');`
      )
      .join("\n")}
  `);
  }

  async function replyPageCompile(
    reply: FastifyReply,
    entryConfig: EntryConfig,
    duckConfig: DuckConfig
  ) {
    const options = createCompilerOptionsForPage(
      entryConfig,
      duckConfig,
      false
    );
    const [compileOutputs] = await compileToJson(options);
    if (compileOutputs.length !== 1) {
      throw new Error(
        `Unexpectedly chunkOutputs.length must be 1, but actual ${compileOutputs.length}`
      );
    }
    reply.code(200).type("application/javascript").send(compileOutputs[0].src);
  }

  server.get<{ Querystring: CompileQuery }>(
    depsUrlPath,
    opts,
    async (request, reply) => {
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
      reply.code(200).type("application/javascript").send(depsContent);
      updateDepsJsCache(config);
    }
  );

  // start server
  const start = async () => {
    const { host, port } = config;
    try {
      await server.listen({ port, host });
    } catch (err: unknown) {
      server.log.error(err as any);
      process.exit(1);
    }
  };

  start();
}

function updateDepsJsCache(config: DuckConfig) {
  const { depsJs } = config;
  if (depsJs) {
    writeCachedDepsOnDisk(depsJs, config.closureLibraryDir).then(
      () =>
        logger.debug(
          `[DEPSJS_UPDATED]: ${path.relative(process.cwd(), depsJs)}`
        ),
      (err) => logger.error({ err }, "Fail to write deps.js")
    );
  }
}

async function createServer(config: DuckConfig): Promise<FastifyInstance> {
  const opts = {
    logger,
    disableRequestLogging: true,
  };
  let server: FastifyInstance;
  if (config.https) {
    const httpsOptions = {
      key: await fs.readFile(config.https.keyPath, "utf8"),
      cert: await fs.readFile(config.https.certPath, "utf8"),
    };
    // Use `any` because the types of http, https and http2 modules in Node.js are not compatible.
    // But it is not a big deal.
    if (config.http2) {
      server = fastify<http2.Http2SecureServer>({
        ...opts,
        https: httpsOptions,
        http2: true,
      }) as FastifyInstance<any, any, any>;
    } else {
      server = fastify({ ...opts, https: httpsOptions });
    }
  } else {
    server = fastify(opts);
  }

  // enable CORS at first
  server.register(cors);

  // customize log output
  server.addHook("onRequest", async ({ raw, log }, reply) => {
    const { method, url } = raw;
    if (
      url?.startsWith(closureLibraryUrlPath) ||
      url?.startsWith(inputsUrlPath)
    ) {
      // skip logging for static assets
      return;
    }
    log.info({ request: `${method} ${url}` }, "incoming request");
  });
  server.addHook("onResponse", async ({ raw, log }, reply) => {
    const { method, url } = raw;
    if (
      url?.startsWith(closureLibraryUrlPath) ||
      url?.startsWith(inputsUrlPath)
    ) {
      // skip logging for static assets
      return;
    }
    log.info(
      {
        request: `${method} ${url || '"N/A"'}`,
        statusCode: reply.statusCode,
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
