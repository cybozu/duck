'use strict';

const {parser, depFile} = require('google-closure-deps');
const recursive = require('recursive-readdir');
const flat = require('array.prototype.flat');

async function genDeps(pageConfig, closureBaseDir) {
  // TODO: exclude closure path
  // TODO: optimize duplicated files
  const parseResultPromises = pageConfig.paths.map(p =>
    recursive(p).then(files =>
      Promise.all(files.filter(file => /\.js$/.test(file)).map(parser.parseFileAsync))
    )
  );
  const results = flat(await Promise.all(parseResultPromises));
  let fatal = false;
  console.log(results);
  const errors = flat(results.map(r => r.errors));
  for (const error of errors) {
    fatal = fatal || error.fatal;
  }
  if (fatal) {
    const e = new Error('Fatal parse error');
    e.errors = errors;
    throw e;
  }
  const deps = results.map(r => r.dependency);
  const text = depFile.getDepFileText(closureBaseDir, deps);
  return text;
}

module.exports = genDeps;
