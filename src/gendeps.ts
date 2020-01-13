import flat from "array.prototype.flat";
import { promises as fs } from "fs";
import glob from "glob";
import { depFile, depGraph, parser } from "google-closure-deps";
import path from "path";
import { promisify } from "util";
import { DependencyParserWithWorkers } from "./dependency-parser-wrapper";
import { EntryConfig } from "./entryconfig";
import { googBaseUrlPath, inputsUrlPath } from "./urls";

const pathToDependencyCache: Map<
  string,
  Promise<depGraph.Dependency>
> = new Map();
const globPromise = promisify(glob);

/**
 * Generate deps.js source text for RAW mode.
 * The result excludes deps of Closure Library.
 */
export async function generateDepFileText(
  entryConfig: Pick<EntryConfig, "paths" | "test-excludes">,
  inputsRoot: string,
  ignoreDirs: readonly string[] = [],
  workers?: number
): Promise<string> {
  const dependencies = await getDependencies(entryConfig, ignoreDirs, workers);
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
  const scriptDeps = dependencies.filter(
    dep => dep.type === depGraph.DependencyType.SCRIPT
  );
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
export async function writeCachedDepsOnDisk(
  depsJsPath: string,
  closureLibraryDir: string
) {
  const closureBaseDir = path.join(closureLibraryDir, "closure", "goog");
  const deps = await Promise.all(Array.from(pathToDependencyCache.values()));
  const content = generateDepFileTextFromDeps(deps, closureBaseDir);
  return fs.writeFile(depsJsPath, content);
}

/**
 * Load and cache deps.js.
 * Call this before getDependencies().
 *
 * @throws if deps.js doesn't exist.
 */
export async function restoreDepsJs(
  depsJsPath: string,
  closureLibraryDir: string
): Promise<void> {
  let depsText = "";
  try {
    depsText = await fs.readFile(depsJsPath, "utf8");
  } catch (e) {
    throw new Error(
      `${depsJsPath} doesn't exist. Run \`duck build:deps\`. ${e}`
    );
  }
  const result = parser.parseDependencyFile(depsText, depsJsPath);
  if (result.hasFatalError) {
    throw new Error(`Fatal parse error in ${depsJsPath}: ${result.errors}`);
  }
  appendGoogImport(
    result.dependencies,
    path.join(closureLibraryDir, "closure", "goog")
  );
  result.dependencies.forEach(dep => {
    pathToDependencyCache.set(dep.path, Promise.resolve(dep));
  });
}

/**
 * Get Dependencies from the paths of the entry config.
 * This ignores filename `deps.js`.
 */
export async function getDependencies(
  entryConfig: Pick<EntryConfig, "paths" | "test-excludes">,
  ignoreDirs: readonly string[] = [],
  numOfWorkers?: number
): Promise<depGraph.Dependency[]> {
  const ignoreDirPatterns = ignoreDirs.map(dir => path.join(dir, "**/*"));
  const parser = new DependencyParserWithWorkers(numOfWorkers);
  try {
    // TODO: uniq
    const parseResultPromises = entryConfig.paths.map(async p => {
      let testExcludes: readonly string[] = [];
      if (entryConfig["test-excludes"]) {
        testExcludes = entryConfig["test-excludes"];
      }
      const files = await globPromise(path.join(p, "**/*.js"), {
        ignore: ignoreDirPatterns,
        follow: true
      });
      return Promise.all(
        files
          // TODO: load deps.js path from config
          .filter(file => !/\bdeps\.js$/.test(file))
          .filter(file => {
            if (testExcludes.some(exclude => file.startsWith(exclude))) {
              return !/_test\.js$/.test(file);
            }
            return true;
          })
          .map(async file => {
            if (pathToDependencyCache.has(file)) {
              return pathToDependencyCache.get(file)!;
            }
            const promise = parser.parse(file);
            pathToDependencyCache.set(file, promise);
            return promise;
          })
      );
    });
    return flat(await Promise.all(parseResultPromises));
  } finally {
    await parser.terminate();
  }
}

/**
 * Get dependencies of Closure Library by loading deps.js
 */
export async function getClosureLibraryDependencies(
  closureLibraryDir: string
): Promise<depGraph.Dependency[]> {
  const googDepsPath = path.join(
    closureLibraryDir,
    "closure",
    "goog",
    "deps.js"
  );
  const depsContent = await fs.readFile(googDepsPath, "utf8");
  const result = parser.parseDependencyFile(depsContent, googDepsPath);
  if (result.errors.length > 0) {
    throw new Error(
      `Fail to parse deps.js of Closure Library: ${result.errors.join(", ")}`
    );
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
function appendGoogImport(
  dependencies: readonly depGraph.Dependency[],
  googBaseDir: string
) {
  dependencies.forEach(dep => {
    dep.setClosurePath(googBaseDir);
    if (
      dep.closureSymbols.length > 0 ||
      dep.imports.find(i => i.isGoogRequire())
    ) {
      const goog = new depGraph.GoogRequire("goog");
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
