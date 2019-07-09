import assert = require("assert");
import { stripIndents } from "common-tags";
import { readFileSync } from "fs";
import { CompilerOptions, convertToFlagfile, createCompilerOptionsForPage } from "../src/compiler";
import { PlovrMode } from "../src/entryconfig";

describe("compiler", () => {
  describe("createComiplerOptionsForPage()", () => {
    it("minimum", async () => {
      const actual = createCompilerOptionsForPage(
        {
          id: "simple",
          mode: PlovrMode.RAW,
          paths: ["/path/to/path1"],
          inputs: ["/input1.js"],
        },
        false
      );
      const expected: CompilerOptions = {
        dependency_mode: "STRICT",
        json_streams: "OUT",
        compilation_level: "WHITESPACE",
        js: ["/path/to/path1"],
        entry_point: ["/input1.js"],
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
        false
      );
      const expected = {
        dependency_mode: "STRICT",
        json_streams: "OUT",
        compilation_level: "WHITESPACE",
        js: ["/path/to/path1"],
        entry_point: ["/input1.js"],
        hide_warnings_for: ["foo/bar"],
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
        false
      );
      assert(typeof actual.warnings_whitelist_file === "string");
      const whitelist = readFileSync(actual.warnings_whitelist_file!, "utf8");
      assert.equal(whitelist, "/path/to/file1.js:1  Error1\n/path/to/file2.js:  Error2");
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
        true
      );
      const expected: CompilerOptions = {
        dependency_mode: "STRICT",
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
        define: ["goog.BOOLEAN=false", "goog.NUMBER=100", "goog.STRING='single-quoted'"],
        js_output_file: "/out.js",
        jscomp_error: ["checkRegExp", "deprecated"],
        jscomp_warning: ["checkVars"],
        jscomp_off: ["checkTypes"],
      };
      assert.deepEqual(actual, expected);
    });
  });
  describe("convertToFlagfile()", () => {
    let debugOrig: any;
    beforeEach(() => {
      debugOrig = console.debug;
      console.debug = () => {};
    });
    afterEach(() => {
      console.debug = debugOrig;
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
});
