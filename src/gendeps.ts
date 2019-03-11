import flat from 'array.prototype.flat';
import fs from 'fs';
import {depFile, depGraph, parser} from 'google-closure-deps';
import path from 'path';
import recursive from 'recursive-readdir';
import util from 'util';
import vm from 'vm';
import {EntryConfig} from './entryconfig';
import {inputsUrlPath, googBaseUrlPath} from './urls';

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
  const depFileText = depFile.getDepFileText(googBaseDirVirtualPath, dependencies);
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

/**
 * Get dependencies of Closure Library by loading deps.js
 */
export async function getClosureLibraryDependencies(
  closureLibraryDir: string
): Promise<depGraph.Dependency[]> {
  const depsContent = await util.promisify(fs.readFile)(
    path.join(closureLibraryDir, 'closure', 'goog', 'deps.js'),
    'utf8'
  );
  const results: depGraph.Dependency[] = [];

  vm.runInNewContext(depsContent, {
    goog: {
      addDependency(
        relPath: string,
        provides: string[],
        requires: string[],
        opt_loadFlags: boolean | {module?: string; lang?: string}
      ) {
        const dep = addClosureDependency(
          relPath,
          provides,
          requires,
          opt_loadFlags,
          closureLibraryDir
        );
        results.push(dep);
      },
    },
  });
  return results;
}

/**
 * Steal goog.addDependency() in the deps.js of Closure Library.
 * Don't use this for deps.js other than Closure Library.
 *
 * @param relPath The path to the js file.
 * @param provides An array of strings with
 *     the names of the objects this file provides.
 * @param requires An array of strings with
 *     the names of the objects this file requires.
 * @param opt_loadFlags Parameters indicating
 *     how the file must be loaded.  The boolean 'true' is equivalent
 *     to {'module': 'goog'} for backwards-compatibility.  Valid properties
 *     and values include {'module': 'goog'} and {'lang': 'es6'}.
 * @param closureLibraryDir Additional param to generate absolute path
 */
export function addClosureDependency(
  relPath: string,
  provides: string[],
  requires: string[],
  opt_loadFlags: boolean | {module?: string; lang?: string} = {},
  closureLibraryDir: string
): depGraph.Dependency {
  const absPath = path.resolve(closureLibraryDir, 'closure/goog', relPath);
  // closure-library doesn't have Es6Import.
  const imports = requires.map(r => new depGraph.GoogRequire(r));
  if (typeof opt_loadFlags === 'boolean') {
    opt_loadFlags = opt_loadFlags ? {module: 'goog'} : {};
  }
  let depType = depGraph.DependencyType.CLOSURE_PROVIDE;
  if (opt_loadFlags.module === 'goog') {
    depType = depGraph.DependencyType.CLOSURE_MODULE;
  } else if (opt_loadFlags.module === 'es6') {
    depType = depGraph.DependencyType.ES6_MODULE;
  }
  const {lang = 'es3'} = opt_loadFlags;
  return new depGraph.Dependency(depType, absPath, provides, imports, lang);
}
