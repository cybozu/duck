import fastify from 'fastify';
import path from 'path';
import serveStatic from 'serve-static';
import cors from 'cors';
import {stripIndents} from 'common-tags';
import gcc from 'google-closure-compiler';
import genDeps from './gendeps';
import loadEntryConfig from './loadentryconfig';
import toCompilerOptions from './tocompileroptions';

const ClosureCompiler = gcc.compiler;

const PORT = 9810;
const HOST = 'localhost';
const baseUri = new URL(`http://${HOST}:${PORT}/`);
const inputsPath = '/inputs';
const closurePath = `${inputsPath}/$$/closure-library`;
const googBaseUri = new URL(`${closurePath}/closure/goog/base.js`, baseUri);
const depsUriBase = new URL(`/deps`, baseUri);

interface DuckConfig {
  closureLibraryDir: string;
  inputsRoot: string;
  entryConfigDir: string;
}

function loadConfig(): DuckConfig {
  return require(path.join(process.cwd(), 'duck.config'));
}

const server = fastify({logger: {prettyPrint: true}});
const config = loadConfig();

// enable CORS at first
server.use(cors());

// static assets
server.use(closurePath, serveStatic(config.closureLibraryDir, {
  maxAge: '1d',
  immutable: true,
}) as any);
server.use(inputsPath, serveStatic(config.inputsRoot) as any);

// route
server.get('/', async (request, reply) => {
  return {hello: 'world'};
});

interface Query {
  id: string;
  mode: 'RAW' | 'WHITESPACE' | 'SIMPLE' | 'ADVANCED';
}

const opts = {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        mode: {type: 'string', enum: ['RAW', 'WHITESPACE', 'SIMPLE', 'ADVANCED']},
      },
      required: ['id'],
    },
  },
};

server.get<Query>('/compile', opts, async (request, reply) => {
  const entryConfig = await loadEntryConfig(request.query.id, config.entryConfigDir, request.query);
  if (entryConfig.modules) {
    return replyChunks(request, reply, entryConfig);
  } else {
    return replyPage(request, reply, entryConfig);
  }
});

function inputsToUris(inputs) {
  return inputs
    .map(input => path.relative(config.inputsRoot, input))
    .map(input => new URL(`${inputsPath}/${input}`, baseUri));
}

function replyChunks(request, reply, entryConfig) {
  if (entryConfig.mode !== 'RAW') {
    return replyChunksCompile(request, reply, entryConfig);
  }
  let rootId;
  const {modules} = entryConfig;
  const moduleInfo = {};
  const moduleUris = {};
  for (const id in modules) {
    const module = modules[id];
    moduleInfo[id] = module.deps;
    const inputs = Array.isArray(module.inputs) ? module.inputs : [module.inputs];
    moduleUris[id] = inputsToUris(inputs);
    if (module.deps.length === 0) {
      rootId = id;
    }
  }
  const rootModuleUris = moduleUris[rootId];
  const depsUri = new URL(depsUriBase.toString());
  depsUri.search = `id=${entryConfig.id}`;
  reply.code(200).type('application/javascript').send(stripIndents`
    document.write('<script src="${googBaseUri}"></script>');
    document.write('<script src="${depsUri}"></script>');
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

function replyChunksCompile(request, reply, entryConfig) {
  throw new Error('Not yet implemented');
}

function replyPage(request, reply, entryConfig) {
  if (entryConfig.mode === 'RAW') {
    const uris = inputsToUris(entryConfig.inputs);
    const depsUri = new URL(depsUriBase.toString());
    depsUri.search = `id=${entryConfig.id}`;
    reply.code(200).type('application/javascript').send(stripIndents`
      document.write('<script src="${googBaseUri}"></script>');
      document.write('<script src="${depsUri}"></script>');
      ${uris.map(uri => `document.write('<script>goog.require("${uri}")</script>');`).join('\n')}
    `);
  } else {
    return replyPageCompile(request, reply, entryConfig);
  }
}

function replyPageCompile(request, reply, entryConfig) {
  const opts = toCompilerOptions(entryConfig);
  const compiler = new ClosureCompiler(opts);
  // TODO: promisify compiler
  return new Promise((resolve, reject) => {
    compiler.run((exitCode, stdout, stderr) => {
      if (stderr) {
        const error = new Error(stderr);
        // TODO: make a custom error
        // error.exitCode = exitCode;
        reject(error);
      }
      reply
        .code(200)
        .type('application/javascript')
        .send(stdout);
      resolve();
    });
  });
}

server.get<Query>('/deps', opts, async (request, reply) => {
  const entryConfig = await loadEntryConfig(request.query.id, config.entryConfigDir, request.query);
  const depsContent = await genDeps(entryConfig, config.closureLibraryDir);
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
