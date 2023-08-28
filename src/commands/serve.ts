import cors from "@fastify/cors";
import serveStatic from "@fastify/static";
import { stripIndents } from "common-tags";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from "fastify";
import { fastify } from "fastify";
import { promises as fs } from "fs";
import path from "path";
import { pino } from "pino";
import { assertNonNullable } from "../assert.js";
import { compileToJson, createCompilerOptions } from "../compiler.js";
import type { DuckConfig } from "../duckconfig.js";
import type { EntryConfig, PlovrMode } from "../entryconfig.js";
import { loadEntryConfigById } from "../entryconfig.js";
import {
  generateDepFileText,
  restoreDepsJs,
  writeCachedDepsOnDisk,
} from "../gendeps.js";
import { logger, setGlobalLogger } from "../logger.js";
import {
  closureLibraryUrlPath,
  compileUrlPath,
  depsUrlPath,
  googBaseUrlPath,
  inputsUrlPath,
} from "../urls.js";
import { watchJsAndSoy } from "../watch.js";

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
    }),
  );

  if (watch) {
    watchJsAndSoy(config);
  }

  if (config.depsJs) {
    restoreDepsJs(config.depsJs, config.closureLibraryDir).then(() =>
      logger.debug("deps.js restored", config.depsJs),
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

  // routes
  interface CompileQuery {
    id: string;
    mode?: PlovrMode;
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
        },
        required: ["id"],
      },
    },
  };

  /**
   * GET RAW or compiled script for the entry config
   */
  server.get<{ Querystring: CompileQuery }>(
    compileUrlPath,
    opts,
    async (request, reply) => {
      const entryConfig = await loadEntryConfigById(
        request.query.id,
        config.entryConfigDir,
        request.query,
      );
      if (entryConfig.mode === "RAW") {
        return replyRaw(reply, entryConfig, config);
      }
      return replyCompile(reply, entryConfig, config);
    },
  );

  /**
   * Get deps.js in RAW mode for the entry config
   */
  server.get<{ Querystring: CompileQuery }>(
    depsUrlPath,
    opts,
    async (request, reply) => {
      const entryConfig = await loadEntryConfigById(
        request.query.id,
        config.entryConfigDir,
        request.query,
      );
      const depsContent = await generateDepFileText(
        entryConfig,
        config.inputsRoot,
        config.depsJsIgnoreDirs.concat(config.closureLibraryDir),
        config.depsWorkers,
      );
      reply.code(200).type("application/javascript").send(depsContent);
      updateDepsJsCache(config);
    },
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

function inputsToUrisForRaw(
  inputs: readonly string[],
  baseUrl: URL,
  inputsRoot: string,
): string[] {
  return inputs
    .map((input) => path.relative(inputsRoot, input))
    .map((input) => new URL(`${inputsUrlPath}/${input}`, baseUrl).toString());
}

function replyRaw(
  reply: FastifyReply,
  entryConfig: EntryConfig,
  duckConfig: DuckConfig,
) {
  const inputs = assertNonNullable(entryConfig.inputs);
  const baseUrl = getScriptBaseUrl(reply, !!duckConfig.https);
  const uris = inputsToUrisForRaw(inputs, baseUrl, duckConfig.inputsRoot);
  reply.code(200).type("application/javascript").send(stripIndents`
    document.write('<script src="${getGoogBaseUrl(baseUrl)}"></script>');
    document.write('<script src="${getDepsUrl(
      baseUrl,
      entryConfig.id,
    )}"></script>');
    ${uris
      .map(
        (uri) => `document.write('<script>goog.require("${uri}")</script>');`,
      )
      .join("\n")}
  `);
}

async function replyCompile(
  reply: FastifyReply,
  entryConfig: EntryConfig,
  duckConfig: DuckConfig,
) {
  const options = createCompilerOptions(entryConfig, duckConfig, false);
  const [compileOutputs] = await compileToJson(options);
  if (compileOutputs.length !== 1) {
    throw new Error(
      `Unexpectedly compileOutputs.length must be 1, but actual ${compileOutputs.length}`,
    );
  }
  reply.code(200).type("application/javascript").send(compileOutputs[0].src);
}

function updateDepsJsCache(config: DuckConfig) {
  const { depsJs } = config;
  if (depsJs) {
    writeCachedDepsOnDisk(depsJs, config.closureLibraryDir).then(
      () =>
        logger.debug(
          `[DEPSJS_UPDATED]: ${path.relative(process.cwd(), depsJs)}`,
        ),
      (err) => logger.error({ err }, "Fail to write deps.js"),
    );
  }
}

async function createServer(config: DuckConfig): Promise<FastifyInstance> {
  const opts = {
    // TODO: Work around for https://github.com/fastify/fastify/issues/4960
    logger: logger as FastifyBaseLogger,
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
      server = fastify({
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
      "request completed",
    );
  });
  return server;
}
