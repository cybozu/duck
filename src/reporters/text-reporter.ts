import {CompileErrorCase, ErrorReason} from '../report';
import {BaseReporter} from './base-reporter';

export interface TextReporterOptions {
  stderr?: boolean;
  outputDir?: string | null;
}

export class TextReporter extends BaseReporter {
  constructor(options: TextReporterOptions = {}) {
    super({
      stderr: options.stderr || true,
      outputDir: options.outputDir || null,
      resultFilename: 'results.txt',
    });
  }

  format({entryConfigPath, command, items}: ErrorReason): string {
    return `# Compile Errors in ${entryConfigPath}:

${command}

${items
  .map(item => (item.level === 'info' ? item.description : this.formatErrorCase(item)))
  .join('\n\n')}`;
  }

  private formatErrorCase(item: CompileErrorCase): string {
    const {source, line, column, level, key, description, context} = item;
    return `${source}:${line}:${column} ${level.toUpperCase()} - [${key}] ${description}${
      context ? `\n${context}` : ''
    }`;
  }
}
