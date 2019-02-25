'use strict';

const path = require('path');
const {parser, depFile} = require('google-closure-deps');
const recursive = require('recursive-readdir');
const flat = require('array.prototype.flat');

const depsCache = new Map();

async function genDeps(pageConfig, closureLibraryPath) {
  // TODO: invalidate updated files
  if (depsCache.has(pageConfig.id)) {
    return depsCache.get(pageConfig.id);
  }
  console.log({paths: pageConfig.paths});
  console.log({closureLibraryPath});
  // TODO: uniq
  const parseResultPromises = pageConfig.paths.map(p =>
    // exclude closure-library
    recursive(p, [path.join(closureLibraryPath, '*')]).then(files =>
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
  const closureBaseDir = path.join(closureLibraryPath, 'closure', 'goog');
  const text = depFile.getDepFileText(closureBaseDir, deps);
  depsCache.set(pageConfig.id, text);
  return text;
}

module.exports = genDeps;
