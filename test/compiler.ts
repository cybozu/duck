import assert = require('assert');
import {createCompilerOptionsForPage, CompilerOptions} from '../src/compiler';
import {PlovrMode} from '../src/entryconfig';

describe('compiler', () => {
  describe('createComiplerOptionsForPage()', () => {
    it('minimum', async () => {
      const actual = createCompilerOptionsForPage(
        {
          id: 'simple',
          mode: PlovrMode.RAW,
          paths: ['/path/to/path1'],
          inputs: ['/input1.js'],
        },
        false
      );
      const expected: CompilerOptions = {
        dependency_mode: 'PRUNE',
        isolation_mode: 'IIFE',
        json_streams: 'OUT',
        compilation_level: 'WHITESPACE',
        js: ['/path/to/path1'],
        entry_point: ['/input1.js'],
      };
      assert.deepEqual(actual, expected);
    });
    it('full', async () => {
      const actual = createCompilerOptionsForPage(
        {
          id: 'simple',
          mode: PlovrMode.SIMPLE,
          paths: ['/path/to/path1'],
          inputs: ['/input1.js'],
          externs: ['/extern1.js'],
          'output-file': '/out.js',
          'language-in': 'ES6',
          'language-out': 'ES5',
          level: 'VERBOSE',
          debug: true,
          'pretty-print': true,
          'print-input-delimiter': true,
          'test-excludes': ['/ignored'],
          define: {
            'goog.BOOLEAN': false,
            'goog.NUMBER': 100,
            'goog.STRING': 'single-quoted',
          },
          checks: {
            checkRegExp: 'ERROR',
            checkTypes: 'OFF',
            checkVars: 'WARNING',
            deprecated: 'ERROR',
          },
        },
        true
      );
      const expected: CompilerOptions = {
        dependency_mode: 'PRUNE',
        isolation_mode: 'IIFE',
        json_streams: 'OUT',
        compilation_level: 'SIMPLE',
        js: ['/path/to/path1', '!/extern1.js'],
        entry_point: ['/input1.js'],
        externs: ['/extern1.js'],
        language_in: 'ES6',
        language_out: 'ES5',
        warning_level: 'VERBOSE',
        debug: true,
        formatting: ['PRETTY_PRINT', 'PRINT_INPUT_DELIMITER'],
        define: ['goog.BOOLEAN=false', 'goog.NUMBER=100', "goog.STRING='single-quoted'"],
        js_output_file: '/out.js',
        jscomp_error: ['checkRegExp', 'deprecated'],
        jscomp_warning: ['checkVars'],
        jscomp_off: ['checkTypes'],
      };
      assert.deepEqual(actual, expected);
    });
  });
});
