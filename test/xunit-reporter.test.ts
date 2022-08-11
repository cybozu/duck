import { strict as assert } from "assert";
import { oneLineTrim } from "common-tags";
import { existsSync, promises as fs } from "fs";
import path from "path";
import tempy from "tempy";
import { afterEach, beforeEach, describe, it } from "vitest";
import { XUnitReporter } from "../src/reporters/xunit-reporter";

const entryConfigPath = "/path/to/entry.json";
const command = "java -jar compiler.jar";

describe("output()", () => {
  let reporter: XUnitReporter;
  let outputDir: string;
  let actualMessage: string | undefined;
  const originalConsoleError = console.error;
  beforeEach(() => {
    outputDir = tempy.directory();
    reporter = new XUnitReporter({ outputDir });
    actualMessage = undefined;
    console.error = (message: string) => (actualMessage = message);
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  const reasons = [
    {
      entryConfigPath,
      command,
      items: [
        {
          level: "info",
          description: "89 error(s), 5 warning(s), 98.4% typed",
        },
      ],
    },
  ] as const;
  const expected = oneLineTrim`
        <?xml version="1.0"?>
        <testsuites>
          <testsuite name="${entryConfigPath}"/>
        </testsuites>`;

  it("makes a directory and a result file", async () => {
    await reporter.output(reasons);
    const actual = await fs.readFile(
      path.join(outputDir, "entry", "results.xml"),
      "utf8"
    );
    assert.equal(actual, expected);
    assert.equal(actualMessage, undefined);
  });

  it("does not make any dirs or files", async () => {
    reporter = new XUnitReporter({ outputDir: null });
    await reporter.output(reasons);
    assert(!existsSync(path.join(process.cwd(), "test-results")));
    assert.equal(actualMessage, undefined);
  });

  it("outputs to stderr", async () => {
    reporter = new XUnitReporter({ outputDir: null, stderr: true });
    await reporter.output(reasons);
    assert.equal(actualMessage, expected);
  });
});

describe("format()", () => {
  let reporter: XUnitReporter;
  beforeEach(() => {
    reporter = new XUnitReporter();
  });

  it("success", async () => {
    const actual = reporter.format({
      entryConfigPath,
      command,
      items: [
        {
          level: "info",
          description: "89 error(s), 5 warning(s), 98.4% typed",
        },
      ],
    });
    assert.equal(
      actual,
      oneLineTrim`<?xml version="1.0"?>
      <testsuites>
        <testsuite name="${entryConfigPath}"/>
      </testsuites>`
    );
  });

  it("error", async () => {
    const actual = reporter.format({
      entryConfigPath,
      command,
      items: [
        {
          level: "error",
          description:
            "Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.",
          key: "JSC_DEPRECATED_CLASS_REASON",
          source:
            "/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js",
          line: 57,
          column: 32,
          context:
            "  this.outstandingEvents_ = new goog.structs.Map();\n                                ^^^^^^^^^^^^^^^^",
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
      </testsuites>`.replace(/%%newline%%/g, "\n")
    );
  });

  it("error without context", async () => {
    const actual = reporter.format({
      entryConfigPath,
      command,
      items: [
        {
          level: "error",
          description:
            "Class goog.structs.Map has been deprecated: This type is misleading: use ES6 Map instead.",
          key: "JSC_DEPRECATED_CLASS_REASON",
          source:
            "/path/to/node_modules/google-closure-library/closure/goog/debug/tracer.js",
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
      </testsuites>`.replace(/%%newline%%/g, "\n")
    );
  });
});
