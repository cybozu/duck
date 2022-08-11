import path from "path";
import type { ErrorReason } from "../report.js";
import { BaseReporter } from "./base-reporter.js";

export interface JsonReporterOptions {
  stderr?: boolean;
  outputDir?: string | null;
}

const DEFAULT_OUTPUT_DIR = path.join("test-results", "json");

export class JsonReporter extends BaseReporter {
  constructor(options: JsonReporterOptions = {}) {
    super({
      stderr: options.stderr || false,
      outputDir:
        options.outputDir === undefined
          ? DEFAULT_OUTPUT_DIR
          : options.outputDir,
      resultFilename: "results.json",
    });
  }

  format(reason: ErrorReason): string {
    return JSON.stringify(reason);
  }
}
