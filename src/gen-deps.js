'use strict';

const {parser, depFile} = require('google-closure-deps');
const recursive = require('recursive-readdir');
const flat = require('array.prototype.flat');

const depsCache = new Map();

async function genDeps(pageConfig, closureBaseDir) {
  // TODO: invalidate updated files
  if (depsCache.has(pageConfig.id)) {
    return depsCache.get(pageConfig.id);
  }
  // TODO: exclude closure path
  // TODO: uniq
  const parseResultPromises = pageConfig.paths.map(p =>
    recursive(p).then(files =>
      Promise.all(files.filter(file => /\.js$/.test(file)).map(parser.parseFileAsync))
    )
  );
  const results = flat(await Promise.all(parseResultPromises));
  const errors = flat(results.map(r => r.errors));
  const hasFatalError = errors.some(err => !!err.fatal);
  if (hasFatalError) {
    const e = new Error('Fatal parse error');
    e.errors = errors;
    throw e;
  }
  const deps = results.map(r => r.dependency);
  const text = depFile.getDepFileText(closureBaseDir, deps);
  depsCache.set(pageConfig.id, text);
  return text;
}

module.exports = genDeps;
