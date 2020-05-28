import assert = require("assert");
import { depGraph } from "google-closure-deps";
import path from "path";
import { parseDependency } from "../src/dependency-parser";
import { DependencyParserWithWorkers } from "../src/dependency-parser-wrapper";

const fixturesBaseDir = path.join(__dirname, "fixtures");

const variousModulesFixturesDir = path.join(fixturesBaseDir, "various-modules");
const expectedVariousModulesDeps = [
  new depGraph.Dependency(
    depGraph.DependencyType.CLOSURE_MODULE,
    `${variousModulesFixturesDir}/closuremodule.js`,
    ["closuremodule"],
    [new depGraph.GoogRequire("goog"), new depGraph.GoogRequire("goog.array")]
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.CLOSURE_PROVIDE,
    `${variousModulesFixturesDir}/closureprovide.js`,
    ["closureprovide"],
    [new depGraph.GoogRequire("goog"), new depGraph.GoogRequire("goog.array")]
  ),
  new depGraph.Dependency(
    depGraph.DependencyType.ES6_MODULE,
    `${variousModulesFixturesDir}/esm-moduleid.js`,
    ["esm"],
    [new depGraph.Es6Import("./foo.js"), new depGraph.GoogRequire("goog")],
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
    [new depGraph.GoogRequire("goog"), new depGraph.GoogRequire("goog.array")]
  ),
] as const;

describe("DependencyParser()", () => {
  it("parses closure provide script", async () => {
    const actual = await parseDependency(
      path.join(variousModulesFixturesDir, "closureprovide.js")
    );
    assertDependencyEquals(actual, expectedVariousModulesDeps[1]);
  });
});

describe("DependencyParserWithWorkers()", () => {
  let parser: DependencyParserWithWorkers;
  beforeEach(() => {
    parser = new DependencyParserWithWorkers();
  });
  afterEach(() => {
    if (parser) {
      parser.terminate();
    }
  });
  it("parses closure provide script with worker", async () => {
    // This requires tsc compiling before testing
    const dep = await parser.parse(
      path.join(variousModulesFixturesDir, "closureprovide.js")
    );
    assertDependencyEquals(dep, expectedVariousModulesDeps[1]);
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
  brokenEs6Import: boolean = false,
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
