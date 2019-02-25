'use strict';

const fastify = require('fastify')({logger: true});
const path = require('path');
const fs = require('fs');
const util = require('util');
const serveStatic = require('serve-static');
const cors = require('cors');
const {stripIndents} = require('common-tags');
const stripJsonComments = require('strip-json-comments');
const genDeps = require('./gen-deps');

const PORT = 9810;
const HOST = 'localhost';
const baseUri = new URL(`http://${HOST}:${PORT}/`);
const assetsPath = '/inputs';
const closurePath = `${assetsPath}/$$/closure-library`;
const googBaseUri = new URL(`${closurePath}/closure/goog/base.js`, baseUri);
const depsUriBase = new URL(`/deps`, baseUri);

function loadConfig() {
  return require(path.join(process.cwd(), 'duck.config'));
}

const config = loadConfig();

// enable CORS at first
fastify.use(cors());

// static assets
fastify.use(closurePath, serveStatic(config.closureLibraryPath, {maxAge: '1d', immutable: true}));
fastify.use(assetsPath, serveStatic(config.root));

fastify.get('/', async (request, reply) => {
  return {hello: 'world'};
});

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

fastify.get('/compile', opts, async (request, reply) => {
  const pageConfig = await loadPageConfig(request.query.id);
  if (pageConfig.modules) {
    replyChunks(request, reply, pageConfig);
  } else {
    replyPage(request, reply, pageConfig);
  }
});

async function loadPageConfig(id) {
  const content = await util.promisify(fs.readFile)(
    path.join(config.pageConfigPath, `${id}.json`),
    'utf8'
  );
  const pageConfig = JSON.parse(stripJsonComments(content));
  pageConfig.paths = pageConfig.paths.map(p => path.resolve(config.pageConfigPath, p));
  if (pageConfig.inputs) {
    pageConfig.inputs = pageConfig.inputs.map(p => path.resolve(config.pageConfigPath, p));
  }
  if (pageConfig.modules) {
    Object.values(pageConfig.modules).forEach(mod => {
      mod.inputs = mod.inputs.map(input => path.resolve(config.pageConfigPath, input));
    });
  }
  return pageConfig;
}

function inputsToUris(inputs) {
  return inputs
    .map(input => path.relative(config.root, input))
    .map(input => new URL(`${assetsPath}/${input}`, baseUri));
}

function replyChunks(request, reply, pageConfig) {
  let rootId;
  const {modules} = pageConfig;
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
  const depsUri = new URL(depsUriBase);
  depsUri.search = `id=${pageConfig.id}`;
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

function replyPage(request, reply, pageConfig) {
  const uris = inputsToUris(pageConfig.inputs);
  const depsUri = new URL(depsUriBase);
  depsUri.search = `id=${pageConfig.id}`;
  reply.code(200).type('application/javascript').send(stripIndents`
    document.write('<script src="${googBaseUri}"></script>');
    document.write('<script src="${depsUri}"></script>');
    ${uris.map(uri => `document.write('<script>goog.require("${uri}")</script>');`).join('\n')}
  `);
}

fastify.get('/deps', opts, async (request, reply) => {
  const pageConfig = await loadPageConfig(request.query.id);
  const depsContent = await genDeps(pageConfig, config.closureLibraryPath);
  reply
    .code(200)
    .type('application/javascript')
    .send(depsContent);
});

const start = async () => {
  try {
    await fastify.listen(PORT, HOST);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
