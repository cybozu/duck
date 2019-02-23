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

fastify.get('/compile', opts, async (request, reply) => {
  const pageId = request.query.id;
  const googBasePath = new URL('/inputs/$$/closure-library/closure/goog/base.js', base);
  const depsPath = new URL('/inputs/deps.js', base);
  // TODO: escape
  reply.code(200).type('application/javascript').send(`
    document.write('<script src="${googBasePath}"></script>');
    document.write('<script src="${depsPath}"></script>');
    document.write('<script>goog.require("${pageId}")</script>');
  `);
});

// static assets
const closureDir = path.dirname(require.resolve('google-closure-library/package.json'));
fastify.use('/inputs/$$/closure-library', serveStatic(closureDir));
const inputsDir = path.join(__dirname, '../examples/closure-scripts');
fastify.use('/inputs', serveStatic(inputsDir));

const start = async () => {
  try {
    await fastify.listen(PORT, HOST);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
