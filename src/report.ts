import { DuckConfig } from "./duckconfig";
import { JsonReporter } from "./reporters/json-reporter";
import { TextReporter } from "./reporters/text-reporter";
import { XUnitReporter } from "./reporters/xunit-reporter";

export type CompileErrorItem = CompileErrorCase | CompileErrorInfo;
export interface CompileErrorCase {
  level: "warning" | "error";
  description: string;
  key: string;
  source: string;
  line: number;
  column: number;
  context?: string;
}
export interface CompileErrorInfo {
  level: "info";
  description: string;
}

export interface ErrorReason {
  entryConfigPath: string;
  /**
   * nullable because google-closure-compiler doesn't include command info when it's a warning.
   */
  command: string | null;
  items: readonly CompileErrorItem[];
}

const reporterClasses = {
  json: JsonReporter,
  text: TextReporter,
  xunit: XUnitReporter,
} as const;

export async function reportTestResults(
  reasons: readonly ErrorReason[],
  config: DuckConfig
): Promise<void> {
  const reporters = config.reporters || ["text"];
  const promises = reporters.map((name) => {
    const options = (config.reporterOptions || {})[name];
    const reporter = new reporterClasses[name](options);
    return reporter.output(reasons);
  });
  await Promise.all(promises);
}
