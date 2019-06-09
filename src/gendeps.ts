import flat from 'array.prototype.flat';
import fs from 'fs';
import {depFile, depGraph, parser} from 'google-closure-deps';
import pLimit from 'p-limit';
import path from 'path';
import recursive from 'recursive-readdir';
import {promisify} from 'util';
import {EntryConfig} from './entryconfig';
import {googBaseUrlPath, inputsUrlPath} from './urls';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const pathToDependencyCache: Map<string, Promise<depGraph.Dependency>> = new Map();

/**
 * Generate deps.js source text for RAW mode.
 * The result excludes deps of Closure Library.
 */
export async function generateDepFileText(
  entryConfig: Pick<EntryConfig, 'paths' | 'test-excludes'>,
  inputsRoot: string,
  ignoreDirs: readonly string[] = []
): Promise<string> {
  const dependencies = await getDependencies(entryConfig, ignoreDirs);
  const googBaseDirVirtualPath = path.dirname(
    path.resolve(inputsRoot, path.relative(inputsUrlPath, googBaseUrlPath))
  );
  return generateDepFileTextFromDeps(dependencies, googBaseDirVirtualPath);
}

export function generateDepFileTextFromDeps(
  dependencies: depGraph.Dependency[],
  googBaseDir: string
): string {
  // `getDepFileText()` doesn't generate addDependency() for SCRIPT,
  // so change the type to CLOSURE_PROVIDE temporally.
  // TODO: fix upstream google-closure-deps and remove this
  const scriptDeps = dependencies.filter(dep => dep.type === depGraph.DependencyType.SCRIPT);
  scriptDeps.forEach(dep => {
    dep.type = depGraph.DependencyType.CLOSURE_PROVIDE;
  });
  const depFileText = depFile.getDepFileText(googBaseDir, dependencies);
  // restore the type
  scriptDeps.forEach(dep => {
    dep.type = depGraph.DependencyType.SCRIPT;
  });
  return depFileText;
}

/**
 * NOTE: This doesn't support ES Modules, because a bug of google-closure-deps.
 */
export async function writeCachedDepsOnDisk(depsJsPath: string, closureLibraryDir: string) {
  const closureBaseDir = path.join(closureLibraryDir, 'closure', 'goog');
  const deps = await Promise.all(Array.from(pathToDependencyCache.values()));
  const content = generateDepFileTextFromDeps(deps, closureBaseDir);
  return writeFile(depsJsPath, content);
}

/**
 * Load and cache deps.js.
 * Call this before getDependencies().
 *
 * @throws if deps.js doesn't exist.
 */
export async function restoreDepsJs(depsJsPath: string, closureLibraryDir: string): Promise<void> {
  let depsText = '';
  try {
    depsText = await readFile(depsJsPath, 'utf8');
  } catch (e) {
    throw new Error(`${depsJsPath} doesn't exist. Run \`duck build:deps\`. ${e}`);
  }
  const result = parser.parseDependencyFile(depsText, depsJsPath);
  if (result.hasFatalError) {
    throw new Error(`Fatal parse error in ${depsJsPath}: ${result.errors}`);
  }
  appendGoogImport(result.dependencies, path.join(closureLibraryDir, 'closure', 'goog'));
  result.dependencies.forEach(dep => {
    pathToDependencyCache.set(dep.path, Promise.resolve(dep));
  });
}

/**
 * Get Dependencies from the paths of the entry config.
 * This ignores filename `deps.js`.
 */
export async function getDependencies(
  entryConfig: Pick<EntryConfig, 'paths' | 'test-excludes'>,
  ignoreDirs: readonly string[] = []
): Promise<depGraph.Dependency[]> {
  const ignoreDirPatterns = ignoreDirs.map(dir => path.join(dir, '*'));
  // TODO: uniq
  const parseResultPromises = entryConfig.paths.map(async p => {
    let testExcludes: readonly string[] = [];
    if (entryConfig['test-excludes']) {
      testExcludes = entryConfig['test-excludes'];
    }
    const files = await recursive(p, ignoreDirPatterns);
    // NOTE: This logic is executed in a single thread (not forking),
    // so this concurrency doesn't affect the prformance.
    // But it improves smooth animation of "in-progress circle" and "Ctrl-C" handling.
    // TODO: Use workers in Node v12+.
    const limit = pLimit(10);
    return Promise.all(
      files
        .filter(file => /\.js$/.test(file))
        // TODO: load deps.js path from config
        .filter(file => !/\bdeps\.js$/.test(file))
        .filter(file => {
          if (testExcludes.some(exclude => file.startsWith(exclude))) {
            return !/_test\.js$/.test(file);
          }
          return true;
        })
        .map(p =>
          limit(() => {
            if (pathToDependencyCache.has(p)) {
              return pathToDependencyCache.get(p)!;
            } else {
              const promise = parser.parseFileAsync(p).then(result => {
                if (result.hasFatalError) {
                  throw new Error(`Fatal parse error in ${p}: ${result.errors}`);
                }
                if (result.dependencies.length > 1) {
                  throw new Error(`A JS file must have only one dependency: ${p}`);
                }
                if (result.dependencies.length === 0) {
                  throw new Error(`No dependencies found: ${p}`);
                }
                return result.dependencies[0];
              });
              pathToDependencyCache.set(p, promise);
              return promise;
            }
          })
        )
    );
  });
  return flat(await Promise.all(parseResultPromises));
}

/**
 * Get dependencies of Closure Library by loading deps.js
 */
export async function getClosureLibraryDependencies(
  closureLibraryDir: string
): Promise<depGraph.Dependency[]> {
  const googDepsPath = path.join(closureLibraryDir, 'closure', 'goog', 'deps.js');
  const depsContent = await readFile(googDepsPath, 'utf8');
  const result = parser.parseDependencyFile(depsContent, googDepsPath);
  if (result.errors.length > 0) {
    throw new Error(`Fail to parse deps.js of Closure Library: ${result.errors.join(', ')}`);
  }
  appendGoogImport(result.dependencies, path.dirname(googDepsPath));
  return result.dependencies;
}

/**
 * deps.js generated by google-closure-deps doesn't include "goog" in the imports.
 * https://github.com/google/closure-library/blob/v20190415/closure-deps/lib/depfile.js#L43-L47
 * To require "base.js", "goog" needs to be added to the imports.
 *
 * @param dependencies
 * @param googBaseDir A path to the directory including base.js
 */
function appendGoogImport(dependencies: readonly depGraph.Dependency[], googBaseDir: string) {
  dependencies.forEach(dep => {
    dep.setClosurePath(googBaseDir);
    if (dep.closureSymbols.length > 0 || dep.imports.find(i => i.isGoogRequire())) {
      const goog = new depGraph.GoogRequire('goog');
      goog.from = dep;
      dep.imports.push(goog);
    }
  });
}

export function countDepCache(): number {
  return pathToDependencyCache.size;
}

export function removeDepCacheByPath(filepath: string): boolean {
  return pathToDependencyCache.delete(filepath);
}

export function clearDepCache(): void {
  pathToDependencyCache.clear();
}
