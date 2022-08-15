import { strict as assert } from "assert";
import { promises as fs } from "fs";
import closureDeps from "google-closure-deps";
import path from "path";
import { temporaryFile } from "tempy";
import { fileURLToPath } from "url";
import { beforeEach, describe, it } from "vitest";
import {
  clearDepCache,
  countDepCache,
  generateDepFileText,
  generateDepFileTextFromDeps,
  getClosureLibraryDependencies,
  getDependencies,
  restoreDepsJs,
  writeCachedDepsOnDisk,
} from "../src/gendeps.js";

import depGraph = closureDeps.depGraph;
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesBaseDir = path.join(__dirname, "fixtures");

const variousModulesFixturesDir = path.join(fixturesBaseDir, "various-modules");
const variousModulesDepsJsPath = path.join(
  fixturesBaseDir,
  "various-modules-deps.js"
);
const expectedVariousModulesDeps = [
  new depGraph.Dependency(
    depGraph.DependencyType.CLOSURE_MODULE,
    `${variousModulesFixturesDir}/closuremodule.js`,
    ["closuremodule"],
    [new depGraph.GoogRequire("goog.array")]
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.CLOSURE_PROVIDE,
    `${variousModulesFixturesDir}/closureprovide.js`,
    ["closureprovide"],
    [new depGraph.GoogRequire("goog.array")]
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.ES6_MODULE,
    `${variousModulesFixturesDir}/esm-moduleid.js`,
    ["esm"],
    [new depGraph.Es6Import("./foo.js")],
    "es6"
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.ES6_MODULE,
    `${variousModulesFixturesDir}/esm.js`,
    [],
    [new depGraph.Es6Import("./foo.js")],
    "es6"
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.SCRIPT,
    `${variousModulesFixturesDir}/script.js`,
    [],
    [new depGraph.GoogRequire("goog.array")]
  ),
] as const;

beforeEach(() => {
  clearDepCache();
});
describe("generateDepFileText()", () => {
  it("returns correct relative path", async () => {
    const inputsRoot = path.join(fixturesBaseDir, "generateDepFileText");
    const closureDir = path.join(inputsRoot, "closure");
    const entryConfig = {
      paths: [inputsRoot],
    };
    assert.equal(
      await generateDepFileText(entryConfig, inputsRoot, [closureDir]),
      "goog.addDependency('../../../../foo/init.js', ['foo.init'], ['foo.bar', 'goog.array']);\n"
    );
  });
});
describe("generateDepFileTextFromDeps()", () => {
  it("outputs SCRIPT type dep", async () => {
    const dep = new depGraph.Dependency(
      depGraph.DependencyType.SCRIPT,
      "/app/foo.js",
      [],
      [new depGraph.GoogRequire("goog.array")]
    );
    const text = await generateDepFileTextFromDeps([dep], "/closure/goog");
    assert.equal(
      text,
      "goog.addDependency('../../app/foo.js', [], ['goog.array']);\n"
    );
    assert.equal(
      dep.type,
      depGraph.DependencyType.SCRIPT,
      "dep.type should not be changed"
    );
  });
});
describe("getDependencies()", () => {
  const fixturesDir = path.join(fixturesBaseDir, "getDependencies");
  function createScriptDependency(filepath: string): any {
    return new depGraph.Dependency(
      depGraph.DependencyType.SCRIPT,
      path.join(fixturesDir, filepath),
      [],
      []
    );
  }
  it("loads all js files in paths", async () => {
    const path1 = path.join(fixturesDir, "path1");
    const path2 = path.join(fixturesDir, "path2");
    const entryConfig = {
      paths: [path1, path2],
    };
    const results = await getDependencies(entryConfig);
    assert.equal(results.length, 6);
    assert.deepEqual(
      new Set(results),
      new Set([
        createScriptDependency("path1/foo.js"),
        createScriptDependency("path1/foo_test.js"),
        createScriptDependency("path2/bar.js"),
        createScriptDependency("path2/bar_test.js"),
        createScriptDependency("path1/path1-1/baz.js"),
        createScriptDependency("path1/path1-1/baz_test.js"),
      ])
    );
  });
  it("does not load files in `ignoreDirs`: sub directory match", async () => {
    const path1 = path.join(fixturesDir, "path1");
    const path11 = path.join(fixturesDir, "path1/path1-1");
    const path2 = path.join(fixturesDir, "path2");
    const entryConfig = {
      paths: [path1, path2],
    };
    const results = await getDependencies(entryConfig, [path11]);
    assert.equal(results.length, 4);
    assert.deepEqual(
      new Set(results),
      new Set([
        createScriptDependency("path1/foo.js"),
        createScriptDependency("path1/foo_test.js"),
        createScriptDependency("path2/bar.js"),
        createScriptDependency("path2/bar_test.js"),
      ])
    );
  });
  it("does not load files in `ignoreDirs`: glob match", async () => {
    const path1 = path.join(fixturesDir, "path1");
    const path2 = path.join(fixturesDir, "path2");
    const entryConfig = {
      paths: [path1, path2],
    };
    const results = await getDependencies(entryConfig, [path2]);
    assert.equal(results.length, 4);
    assert.deepEqual(
      new Set(results),
      new Set([
        createScriptDependency("path1/foo.js"),
        createScriptDependency("path1/foo_test.js"),
        createScriptDependency("path1/path1-1/baz.js"),
        createScriptDependency("path1/path1-1/baz_test.js"),
      ])
    );
  });
  it("does not load `*_test.js` in `test-excludes` dirs", async () => {
    const path1 = path.join(fixturesDir, "path1");
    const path2 = path.join(fixturesDir, "path2");
    const entryConfig = {
      paths: [path1, path2],
      "test-excludes": [path2],
    };
    const results = await getDependencies(entryConfig);
    assert.equal(results.length, 5);
    assert.deepEqual(
      new Set(results),
      new Set([
        createScriptDependency("path1/foo.js"),
        createScriptDependency("path1/foo_test.js"),
        createScriptDependency("path1/path1-1/baz.js"),
        createScriptDependency("path1/path1-1/baz_test.js"),
        createScriptDependency("path2/bar.js"),
      ])
    );
  });
  it("loads various modules", async () => {
    const entryConfig = {
      paths: [variousModulesFixturesDir],
    };
    const deps = await getDependencies(entryConfig);
    deps.sort((a, b) => a.path.localeCompare(b.path));
    assertDependenciesEqual(deps, expectedVariousModulesDeps);
    // Generate deps.js for testing
    if (process.env.DUMP_DEPS) {
      const text = await generateDepFileTextFromDeps(
        deps,
        path.join(fixturesDir, "closure", "goog")
      );
      await fs.writeFile(variousModulesDepsJsPath, text, "utf8");
    }
  });
});
describe("writeCachedDepsOnDisk()", () => {
  const fixturesDir = path.join(fixturesBaseDir, "writeCachedDepsOnDisk");
  it("writes the same content as the deps.js from which it was read", async () => {
    // NOTE: This doesn't support ES Modules, because a bug of google-closure-deps.
    const originalDepsJs = path.join(fixturesDir, "deps.js");
    const closureLibraryDir = path.join(fixturesDir, "closure");
    await restoreDepsJs(originalDepsJs, closureLibraryDir);
    const actualDepsJsPath = temporaryFile({
      name: "writeCachedDepsOnDisk-deps.js",
    });
    await writeCachedDepsOnDisk(actualDepsJsPath, closureLibraryDir);
    const actual = await fs.readFile(actualDepsJsPath, "utf8");
    const expected = await fs.readFile(originalDepsJs, "utf8");
    assert.equal(actual, expected);
  });
});
describe("restoreDepsJs()", () => {
  it("restores various modules from deps.js", async () => {
    assert.equal(countDepCache(), 0);
    await restoreDepsJs(variousModulesDepsJsPath, variousModulesFixturesDir);
    assert.equal(countDepCache(), 5);

    const entryConfig = {
      paths: [variousModulesFixturesDir],
    };
    const deps = await getDependencies(entryConfig);
    deps.sort((a, b) => a.path.localeCompare(b.path));
    assert.equal(countDepCache(), 5, "No added caches");
    assertDependenciesEqual(deps, expectedVariousModulesDeps, true);
  });
});
describe("getClosureLibraryDependencies()", () => {
  it("loads deps of closure-library from the deps.js", async () => {
    const closureLib1 = path.resolve(fixturesBaseDir, "closure-lib1");
    const deps = await getClosureLibraryDependencies(closureLib1);
    deps.sort((a, b) => a.path.localeCompare(b.path));
    assertDependenciesEqual(deps, [
      new depGraph.Dependency(
        depGraph.DependencyType.CLOSURE_PROVIDE,
        `${closureLib1}/closure/goog/a11y/aria/aria.js`,
        ["goog.a11y.aria"],
        [new depGraph.GoogRequire("goog.a11y.aria.Role")]
      ),
      new depGraph.Dependency(
        depGraph.DependencyType.CLOSURE_MODULE,
        `${closureLib1}/closure/goog/collections/sets.js`,
        ["goog.collections.sets"],
        [],
        "es6"
      ),
    ]);
  });
});

function assertImportEquals(
  actual: depGraph.Import,
  expected: depGraph.Import,
  brokenEs6Import: boolean,
  msg?: string
): void {
  assert(actual, msg);
  assert.equal(actual.isGoogRequire(), expected.isGoogRequire(), msg);
  assert.equal(actual.isEs6Import(), expected.isEs6Import(), msg);
  if (expected.isEs6Import() && brokenEs6Import) {
    // NOTE: symOrPath of Es6Import is broken if loaded from deps.js.
    // The path is relative from the file originally,
    // but it is changed to relative path from base.js in parsing deps.js.
    // IMO it's a bug of closure-deps, this assertion detects the fix in the future.
    assert.notEqual(actual.symOrPath, expected.symOrPath, msg);
  } else {
    assert.equal(actual.symOrPath, expected.symOrPath, msg);
  }
  assert(actual.from, msg);
  assert(expected.from, msg);
  assert.deepEqual(
    actual.from.closureSymbols.slice().sort(),
    expected.from.closureSymbols.slice().sort()
  );
}

function assertDependencyEquals(
  actual: depGraph.Dependency,
  expected: depGraph.Dependency,
  brokenEs6Import: boolean,
  msg?: string
): void {
  assert(actual, msg);
  assert.equal(actual.type, expected.type, msg);
  assert.equal(actual.path, expected.path, msg);
  assert.equal(actual.language, expected.language, msg);
  assert.deepEqual(
    actual.closureSymbols.slice().sort(),
    expected.closureSymbols.slice().sort()
  );
  const expectedImports = expected.imports
    .slice()
    .sort((a, b) => a.symOrPath.localeCompare(b.symOrPath));
  const actualImports = actual.imports
    .slice()
    .sort((a, b) => a.symOrPath.localeCompare(b.symOrPath));
  expectedImports.forEach((e, idx) => {
    assertImportEquals(actualImports[idx], e, brokenEs6Import, msg);
  });
  assert.equal(actualImports.length, expectedImports.length, msg);
}

function assertDependenciesEqual(
  actual: readonly depGraph.Dependency[],
  expected: readonly depGraph.Dependency[],
  brokenEs6Import = false
): void {
  expected.forEach((e, idx) => {
    assertDependencyEquals(
      actual[idx],
      e,
      brokenEs6Import,
      `fail in ${e.path}`
    );
  });
  assert.equal(actual.length, expected.length);
}
