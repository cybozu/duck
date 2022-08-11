import { strict as assert } from "assert";
import { stripIndents } from "common-tags";
import { readFileSync } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, it } from "vitest";
import {
  convertToFlagfile,
  createCompilerOptionsForPage,
} from "../src/compiler.js";
import type { ExtendedCompilerOptions } from "../src/compiler-core.js";
import type { DuckConfig } from "../src/duckconfig.js";
import { PlovrMode } from "../src/entryconfig.js";

const emptyDuckConfig: DuckConfig = {} as DuckConfig;

/**
 * Get a relative path from process.cwd()
 */
function relative(filepath: string): string {
  return path.relative(process.cwd(), filepath);
}

/**
 * See https://github.com/teppeis/duck/pull/361
 */
const DEPS_MODE_FOR_PAGE = process.env.OLDEST_COMPILER ? "STRICT" : "PRUNE";

describe("createComiplerOptionsForPage()", () => {
  it("minimum", async () => {
    const actual = createCompilerOptionsForPage(
      {
        id: "simple",
        mode: PlovrMode.RAW,
        paths: ["/path/to/path1"],
        inputs: ["/input1.js"],
      },
      emptyDuckConfig,
      false
    );
    const expected: ExtendedCompilerOptions = {
      compilerOptions: {
        dependency_mode: DEPS_MODE_FOR_PAGE,
        json_streams: "OUT",
        compilation_level: "WHITESPACE",
        js: ["/path/to/path1"],
        entry_point: ["/input1.js"],
      },
    };
    assert.deepEqual(actual, expected);
  });

  it("experimental-compiler-options", async () => {
    const actual = createCompilerOptionsForPage(
      {
        id: "simple",
        mode: PlovrMode.RAW,
        paths: ["/path/to/path1"],
        inputs: ["/input1.js"],
        "experimental-compiler-options": {
          hideWarningsFor: ["foo/bar"],
        },
      },
      emptyDuckConfig,
      false
    );
    const expected: ExtendedCompilerOptions = {
      compilerOptions: {
        dependency_mode: DEPS_MODE_FOR_PAGE,
        json_streams: "OUT",
        compilation_level: "WHITESPACE",
        js: ["/path/to/path1"],
        entry_point: ["/input1.js"],
        hide_warnings_for: ["foo/bar"],
      },
    };
    assert.deepEqual(actual, expected);
  });
  it("warningsWhitelist", async () => {
    const actual = createCompilerOptionsForPage(
      {
        id: "simple",
        mode: PlovrMode.RAW,
        paths: ["/path/to/path1"],
        inputs: ["/input1.js"],
        warningsWhitelist: [
          { file: "/path/to/file1.js", line: 1, description: "Error1" },
          { file: "/path/to/file2.js", description: "Error2" },
        ],
      },
      emptyDuckConfig,
      false
    );
    assert.deepEqual(actual.warningsWhitelist, [
      { file: "/path/to/file1.js", line: 1, description: "Error1" },
      { file: "/path/to/file2.js", description: "Error2" },
    ]);
    // const whitelist = readFileSync(actual.warnings_whitelist_file!, "utf8");
    // assert.equal(whitelist, "/path/to/file1.js:1  Error1\n/path/to/file2.js:  Error2");
  });
  it("full", async () => {
    const actual = createCompilerOptionsForPage(
      {
        id: "simple",
        mode: PlovrMode.SIMPLE,
        paths: ["/path/to/path1"],
        inputs: ["/input1.js"],
        externs: ["/extern1.js"],
        "output-file": "/out.js",
        "language-in": "ES6",
        "language-out": "ES5",
        level: "VERBOSE",
        debug: true,
        "pretty-print": true,
        "print-input-delimiter": true,
        "test-excludes": ["/ignored"],
        "global-scope-name": "GSN",
        define: {
          "goog.BOOLEAN": false,
          "goog.NUMBER": 100,
          "goog.STRING": "single-quoted",
        },
        checks: {
          checkRegExp: "ERROR",
          checkTypes: "OFF",
          checkVars: "WARNING",
          deprecated: "ERROR",
        },
      },
      emptyDuckConfig,
      true
    );
    const expected: ExtendedCompilerOptions = {
      compilerOptions: {
        dependency_mode: DEPS_MODE_FOR_PAGE,
        compilation_level: "SIMPLE",
        js: ["/path/to/path1", "!/extern1.js"],
        entry_point: ["/input1.js"],
        externs: ["/extern1.js"],
        language_in: "ES6",
        language_out: "ES5",
        warning_level: "VERBOSE",
        debug: true,
        formatting: ["PRETTY_PRINT", "PRINT_INPUT_DELIMITER"],
        rename_prefix_namespace: "z", // "z" is hard coded
        output_wrapper: "var GSN={};(function(z){%output%}).call(this,GSN);",
        define: [
          "goog.BOOLEAN=false",
          "goog.NUMBER=100",
          "goog.STRING='single-quoted'",
        ],
        js_output_file: "/out.js",
        jscomp_error: ["checkRegExp", "deprecated"],
        jscomp_warning: ["checkVars"],
        jscomp_off: ["checkTypes"],
      },
    };
    assert.deepEqual(actual, expected);
  });
});
it("batch: aws", async () => {
  const actual = createCompilerOptionsForPage(
    {
      id: "simple",
      mode: PlovrMode.RAW,
      externs: ["/path/to/extern1.js"],
      paths: ["/path/to/path1"],
      inputs: ["/input1.js"],
      warningsWhitelist: [
        { file: "/path/to/file1.js", line: 1, description: "Error1" },
        { file: "/path/to/file2.js", description: "Error2" },
      ],
    },
    { batch: "aws" } as DuckConfig,
    false
  );
  const expected: ExtendedCompilerOptions = {
    compilerOptions: {
      dependency_mode: DEPS_MODE_FOR_PAGE,
      json_streams: "OUT",
      compilation_level: "WHITESPACE",
      externs: [relative("/path/to/extern1.js")],
      js: [relative("/path/to/path1"), `!${relative("/path/to/extern1.js")}`],
      entry_point: [relative("/input1.js")],
    },
    batch: "aws",
    warningsWhitelist: [
      {
        file: relative("/path/to/file1.js"),
        line: 1,
        description: "Error1",
      },
      { file: relative("/path/to/file2.js"), description: "Error2" },
    ],
  };
  assert.deepEqual(actual, expected);
});
describe("convertToFlagfile()", () => {
  let consoleInfoOrig: any;
  beforeEach(() => {
    consoleInfoOrig = console.info;
    console.info = () => {};
  });
  afterEach(() => {
    console.info = consoleInfoOrig;
  });
  it("converts empty options", () => {
    const { flagfile } = convertToFlagfile({});
    const content = readFileSync(flagfile, "utf8");
    assert(content === ``);
  });
  it("escape and quote", () => {
    const { flagfile } = convertToFlagfile({
      compilation_level: "ADVANCED",
      js_output_file: '/a b".js',
      js: ['/a b".js', '/c d".js'],
    });
    const content = readFileSync(flagfile, "utf8");
    assert.equal(
      content,
      stripIndents`
          --compilation_level "ADVANCED"
          --js_output_file "/a b\\".js"
          --js "/a b\\".js"
          --js "/c d\\".js"`
    );
  });
});
