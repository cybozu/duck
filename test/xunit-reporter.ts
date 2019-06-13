import assert = require('assert');
import {oneLineTrim} from 'common-tags';
import {formatXUnitReport} from '../src/reporters/xunit-reporter';

describe('xunit-reporter', () => {
  describe('formatXUnitReport()', () => {
    const entryConfigPath = '/path/to/entryConfig.json';
    const command = 'java -jar compiler.jar';
    it('success', async () => {
      const actual = formatXUnitReport({
        entryConfigPath,
        command,
        items: [{level: 'info', description: '89 error(s), 5 warning(s), 98.4% typed'}],
      });
      assert.equal(
        actual,
        oneLineTrim`<?xml version="1.0"?>
      <testsuites>
        <testsuite name="${entryConfigPath}"/>
      </testsuites>`
      );
    });
    it('error', async () => {
      const actual = formatXUnitReport({
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
        oneLineTrim`<?xml version="1.0"?>
      <testsuites>
        <testsuite name="${entryConfigPath}">
          <testcase classname="/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js" name="JSC_DEPRECATED_CLASS_REASON">
            <failure message="Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead. (line 57, col 32)">
              <![CDATA[  this.outstandingEvents_ = new goog.structs.Map();%%newline%%                                ^^^^^^^^^^^^^^^^]]>
            </failure>
          </testcase>
        </testsuite>
      </testsuites>`.replace(/%%newline%%/g, '\n')
      );
    });
    it('error without context', async () => {
      const actual = formatXUnitReport({
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
        oneLineTrim`<?xml version="1.0"?>
      <testsuites>
        <testsuite name="${entryConfigPath}">
          <testcase classname="/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js" name="JSC_DEPRECATED_CLASS_REASON">
            <failure message="Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead. (line 57, col 32)"/>
          </testcase>
        </testsuite>
      </testsuites>`.replace(/%%newline%%/g, '\n')
      );
    });
  });
});
