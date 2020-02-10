import { CompileErrorCase, ErrorReason } from "../report";
import { BaseReporter } from "./base-reporter";

export interface TextReporterOptions {
  stderr?: boolean;
  outputDir?: string | null;
}

export class TextReporter extends BaseReporter {
  constructor(options: TextReporterOptions = {}) {
    super({
      stderr: options.stderr || true,
      outputDir: options.outputDir || null,
      resultFilename: "results.txt"
    });
  }

  format({ entryConfigPath, command, items }: ErrorReason): string {
    // if items doesn't include any errors or warnings,
    // we ignore "info" that includes the line of summary like:
    // "0 error(s), 0 warning(s), xx% typed"
    if (items.filter(i => i.level !== "info").length === 0) {
      return "";
    }
    return `# ${entryConfigPath}:
${command ? `\n${command}\n` : ""}
${items
  .map(item =>
    item.level === "info" ? item.description : this.formatErrorCase(item)
  )
  .join("\n\n")}\n`;
  }

  private formatErrorCase(item: CompileErrorCase): string {
    const { source, line, column, level, key, description, context } = item;
    const errorCode = `[${key}] `;
    const code = context ? `\n${context}` : "";
    return `${source}:${line}:${column} ${level.toUpperCase()} - ${errorCode}${description}${code}`;
  }
}
