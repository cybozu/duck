import path from "path";
import xmlbuilder from "xmlbuilder";
import { CompileErrorCase, ErrorReason } from "../report";
import { BaseReporter } from "./base-reporter";

export interface XUnitReporterOptions {
  stderr?: boolean;
  outputDir?: string | null;
}

const DEFAULT_OUTPUT_DIR = path.join("test-results", "xunit");

export class XUnitReporter extends BaseReporter {
  constructor(options: XUnitReporterOptions = {}) {
    super({
      stderr: options.stderr || false,
      outputDir: options.outputDir === undefined ? DEFAULT_OUTPUT_DIR : options.outputDir,
      resultFilename: "results.xml",
    });
  }

  format({ entryConfigPath, items }: ErrorReason): string {
    const testsuites = xmlbuilder.create("testsuites");
    const testsuite = testsuites.element("testsuite").attribute("name", entryConfigPath);
    const errors = items.filter(item => item.level === "error") as CompileErrorCase[];
    if (errors.length > 0) {
      errors.forEach(error => {
        const testcase = testsuite
          .element("testcase")
          .attribute("classname", error.source)
          .attribute("name", error.key);
        const message = `${error.description} (line ${error.line}, col ${error.column})`;
        const failure = testcase.element("failure").attribute("message", message);
        if (error.context) {
          failure.cdata(error.context);
        }
      });
      return testsuites.end();
    } else {
      return testsuites.end();
    }
  }
}
