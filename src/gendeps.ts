import flat from 'array.prototype.flat';
import fs from 'fs';
import {depFile, depGraph, parser} from 'google-closure-deps';
import path from 'path';
import recursive from 'recursive-readdir';
import util from 'util';
import {EntryConfig} from './entryconfig';
import {googBaseUrlPath, inputsUrlPath} from './urls';

const depFileTextCache: Map<string, string> = new Map();
const dependenciesCache: Map<string, depGraph.Dependency[]> = new Map();

/**
 * Generate deps.js source text for RAW mode.
 * The result excludes deps of Closure Library.
 *
 * @param entryConfig
 * @param closureLibraryDir "${closureLibraryDir}/closure/goog/base.js" exists.
 * @param inputsRoot
 */
export async function generateDepFileText(
  entryConfig: EntryConfig,
  closureLibraryDir: string,
  inputsRoot: string
): Promise<string> {
  // TODO: invalidate updated files
  if (depFileTextCache.has(entryConfig.id)) {
    return depFileTextCache.get(entryConfig.id)!;
  }
  const dependencies = await getDependencies(entryConfig, closureLibraryDir);
  const googBaseDirVirtualPath = path.dirname(
    path.resolve(inputsRoot, path.relative(inputsUrlPath, googBaseUrlPath))
  );
  // `getDepFileText()` doesn't generate addDependency() for SCRIPT,
  // so change the type to CLOSURE_PROVIDE temporally.
  // TODO: remove in the future
  const scriptDeps = dependencies.filter(dep => dep.type === depGraph.DependencyType.SCRIPT);
  scriptDeps.forEach(dep => {
    dep.type = depGraph.DependencyType.CLOSURE_PROVIDE;
  });
  const depFileText = depFile.getDepFileText(googBaseDirVirtualPath, dependencies);
  // restore the type
  scriptDeps.forEach(dep => {
    dep.type = depGraph.DependencyType.SCRIPT;
  });
  depFileTextCache.set(entryConfig.id, depFileText);
  return depFileText;
}

/**
 * Get Dependencies from the paths of the entry config
 */
export async function getDependencies(
  entryConfig: EntryConfig,
  ignoreDir?: string
): Promise<depGraph.Dependency[]> {
  // TODO: invalidate updated files
  if (dependenciesCache.has(entryConfig.id)) {
    return dependenciesCache.get(entryConfig.id)!;
  }
  // TODO: uniq
  const parseResultPromises = entryConfig.paths.map(async p => {
    const ignoreDirs: string[] = [];
    if (ignoreDir) {
      ignoreDirs.push(path.join(ignoreDir, '*'));
    }
    let testExcludes: string[] | null = null;
    if (entryConfig['test-excludes']) {
      testExcludes = entryConfig['test-excludes'];
    }
    const files = await recursive(p, ignoreDirs);
    return Promise.all(
      files
        .filter(file => /\.js$/.test(file))
        .filter(file => {
          if (testExcludes && testExcludes.some(exclude => file.startsWith(exclude))) {
            return !/_test\.js$/.test(file);
          }
          return true;
        })
        .map(parser.parseFileAsync)
    );
  });
  const results = flat(await Promise.all(parseResultPromises));
  if (results.some(result => result.hasFatalError)) {
    // TODO: create an custom error and send `errors`
    throw new Error('Fatal parse error');
  }
  const deps = flat(results.map(r => r.dependencies));
  dependenciesCache.set(entryConfig.id, deps);
  return deps;
}

/**
 * Get dependencies of Closure Library by loading deps.js
 */
export async function getClosureLibraryDependencies(
  closureLibraryDir: string
): Promise<depGraph.Dependency[]> {
  const googBasePath = path.join(closureLibraryDir, 'closure', 'goog', 'deps.js');
  const depsContent = await util.promisify(fs.readFile)(googBasePath, 'utf8');
  const result = parser.parseDependencyFile(depsContent, googBasePath);
  if (result.errors.length > 0) {
    throw new Error(`Fail to parse deps.js of Closure Library: ${result.errors.join(', ')}`);
  }
  const googBaseDir = path.dirname(googBasePath);
  result.dependencies.forEach(dep => dep.setClosurePath(googBaseDir));
  return result.dependencies;
}
