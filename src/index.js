'use strict';

const fastify = require('fastify')({logger: true});
const path = require('path');
const serveStatic = require('serve-static');
const cors = require('cors');

const PORT = 9810;
const HOST = 'localhost';
const base = new URL(`http://${HOST}:${PORT}/`);

fastify.use(cors());

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

const assetsPath = '/inputs';
const closurePath = `${assetsPath}/$$/closure-library`;
fastify.get('/compile', opts, async (request, reply) => {
  const pageId = request.query.id;
  if (/[^._a-zA-Z0-9]/.test(pageId)) {
    throw new Error(`Invalid pageId format: ${pageId}`);
  }
  if (pageId === 'chunks') {
    const googBasePath = new URL(`${closurePath}/closure/goog/base.js`, base);
    const depsPath = new URL(`${assetsPath}/deps.js`, base);
    const moduleInfo = {
      chunks: [],
      chunk1: ['chunks'],
      chunk2: ['chunks'],
    };
    const moduleUris = {
      chunks: new URL(`${assetsPath}/main.js`, base),
      chunk1: new URL(`${assetsPath}/chunk1.js`, base),
      chunk2: new URL(`${assetsPath}/chunk2.js`, base),
    };
    const rootModuleUri = moduleUris.chunks;
    reply.code(200).type('application/javascript').send(`
      document.write('<script src="${googBasePath}"></script>');
      document.write('<script src="${depsPath}"></script>');
      document.write('<script>goog.global.PLOVR_MODULE_INFO = ${JSON.stringify(
        moduleInfo
      )}</script>');
      document.write('<script>goog.global.PLOVR_MODULE_URIS = ${JSON.stringify(
        moduleUris
      )}</script>');
      document.write('<script>goog.require("${rootModuleUri}")</script>');
    `);
  } else {
    const googBasePath = new URL(`${closurePath}/closure/goog/base.js`, base);
    const depsPath = new URL(`${assetsPath}/deps.js`, base);
    reply.code(200).type('application/javascript').send(`
      document.write('<script src="${googBasePath}"></script>');
      document.write('<script src="${depsPath}"></script>');
      document.write('<script>goog.require("${pageId}")</script>');
    `);
  }
});

// static assets
const closureDir = path.dirname(require.resolve('google-closure-library/package.json'));
fastify.use(closurePath, serveStatic(closureDir, {maxAge: '1d', immutable: true}));
// TODO
// const inputsDir = path.join(__dirname, '../examples/closure-scripts');
const inputsDir = path.join(__dirname, '../examples/chunks');
fastify.use(assetsPath, serveStatic(inputsDir));

const start = async () => {
  try {
    await fastify.listen(PORT, HOST);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
