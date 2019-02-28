import path from 'path';
import closureDeps from 'google-closure-deps';
import recursive from 'recursive-readdir';
import flat from 'array.prototype.flat';

const {parser, depFile} = closureDeps;

const depsCache = new Map();

export default async function genDeps(pageConfig, closureLibraryDir) {
  // TODO: invalidate updated files
  if (depsCache.has(pageConfig.id)) {
    return depsCache.get(pageConfig.id);
  }
  // TODO: uniq
  const parseResultPromises = pageConfig.paths.map(p =>
    // exclude closure-library
    recursive(p, [path.join(closureLibraryDir, '*')]).then(files =>
      Promise.all(files.filter(file => /\.js$/.test(file)).map(parser.parseFileAsync))
    )
  );
  const results = flat(await Promise.all(parseResultPromises));
  const errors = flat(results.map(r => r.errors));
  const hasFatalError = errors.some(err => !!err.fatal);
  if (hasFatalError) {
    // TODO: create an custom error and send `errors`
    throw new Error('Fatal parse error');
  }
  const deps = results.map(r => r.dependency);
  const closureBaseDir = path.join(closureLibraryDir, 'closure', 'goog');
  const text = depFile.getDepFileText(closureBaseDir, deps);
  depsCache.set(pageConfig.id, text);
  return text;
}
