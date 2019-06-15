import assert = require('assert');
import {stripIndent} from 'common-tags';
import {TextReporter} from '../src/reporters/text-reporter';

describe('TextReporter', () => {
  describe('format()', () => {
    const entryConfigPath = '/path/to/entryConfig.json';
    const command = 'java -jar compiler.jar';
    let reporter: TextReporter;
    beforeEach(() => {
      reporter = new TextReporter();
    });
    it('success', async () => {
      // TODO: don't report as errors
      const actual = reporter.format({
        entryConfigPath,
        command,
        items: [{level: 'info', description: '89 error(s), 5 warning(s), 98.4% typed'}],
      });
      assert.equal(
        actual,
        stripIndent`
# Compile Errors in /path/to/entryConfig.json:

${command}

89 error(s), 5 warning(s), 98.4% typed`
      );
    });

    it('error', async () => {
      const actual = reporter.format({
        entryConfigPath,
        command,
        items: [
          {
            level: 'error',
            description:
              'Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.',
            key: 'JSC_DEPRECATED_CLASS_REASON',
            source: '/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js',
            line: 57,
            column: 32,
            context:
              '  this.outstandingEvents_ = new goog.structs.Map();\n                                ^^^^^^^^^^^^^^^^',
          },
        ],
      });
      assert.equal(
        actual,
        stripIndent`
# Compile Errors in /path/to/entryConfig.json:

${command}

/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js:57:32 ERROR - [JSC_DEPRECATED_CLASS_REASON] Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.
  this.outstandingEvents_ = new goog.structs.Map();\n                                ^^^^^^^^^^^^^^^^`
      );
    });

    it('error without context', async () => {
      const actual = reporter.format({
        entryConfigPath,
        command,
        items: [
          {
            level: 'error',
            description:
              'Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.',
            key: 'JSC_DEPRECATED_CLASS_REASON',
            source: '/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js',
            line: 57,
            column: 32,
          },
        ],
      });
      assert.equal(
        actual,
        stripIndent`
# Compile Errors in /path/to/entryConfig.json:

${command}

/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js:57:32 ERROR - [JSC_DEPRECATED_CLASS_REASON] Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.`
      );
    });
  });
});
