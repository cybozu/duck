import flat from 'array.prototype.flat';
import {depFile, depGraph, parser} from 'google-closure-deps';
import path from 'path';
import recursive from 'recursive-readdir';
import {EntryConfig} from './entryconfig';

const depFileTextCache: Map<string, string> = new Map();
const dependenciesCache: Map<string, depGraph.Dependency[]> = new Map();

/**
 * Generate deps.js source text for Closure Compiler RAW mode.
 *
 * @param entryConfig
 * @param closureLibraryDir "${closureLibraryDir}/closure/goog/base.js" exists.
 */
export async function generateDepFileText(
  entryConfig: EntryConfig,
  closureLibraryDir: string
): Promise<string> {
  // TODO: invalidate updated files
  if (depFileTextCache.has(entryConfig.id)) {
    return depFileTextCache.get(entryConfig.id);
  }
  const dependencies = await getDependencies(entryConfig, closureLibraryDir);
  const closureBaseDir = path.join(closureLibraryDir, 'closure', 'goog');
  const depFileText = depFile.getDepFileText(closureBaseDir, dependencies);
  depFileTextCache.set(entryConfig.id, depFileText);
  return depFileText;
}

export async function getDependencies(
  entryConfig: EntryConfig,
  ignoreDir?: string
): Promise<depGraph.Dependency[]> {
  // TODO: invalidate updated files
  if (dependenciesCache.has(entryConfig.id)) {
    return dependenciesCache.get(entryConfig.id);
  }
  // TODO: uniq
  const parseResultPromises = entryConfig.paths.map(async p => {
    const ignoreDirs: string[] = [];
    if (ignoreDir) {
      ignoreDirs.push(path.join(ignoreDir, '*'));
    }
    const files = await recursive(p, ignoreDirs);
    return Promise.all(files.filter(file => /\.js$/.test(file)).map(parser.parseFileAsync));
  });
  const results = flat(await Promise.all(parseResultPromises));
  const errors = flat(results.map(r => r.errors));
  const hasFatalError = errors.some(err => !!err.fatal);
  if (hasFatalError) {
    // TODO: create an custom error and send `errors`
    throw new Error('Fatal parse error');
  }
  const deps = results.map(r => r.dependency);
  dependenciesCache.set(entryConfig.id, deps);
  return deps;
}
