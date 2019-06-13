import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import {assertString} from './assert';
import {DuckConfig} from './duckconfig';
import {formatTextReport} from './reporters/text-reporter';
import {formatXUnitReport} from './reporters/xunit-reporter';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

export type CompileErrorItem = CompileErrorCase | CompileErrorInfo;
export interface CompileErrorCase {
  level: 'warning' | 'error';
  description: string;
  key: string;
  source: string;
  line: number;
  column: number;
  context?: string;
}
export interface CompileErrorInfo {
  level: 'info';
  description: string;
}

export interface ErrorReason {
  entryConfigPath: string;
  command: string;
  items: readonly CompileErrorItem[];
}

export async function reportTestResults(
  reasons: readonly ErrorReason[],
  config: DuckConfig
): Promise<void> {
  if (config.reporter === 'xunit') {
    const outputDir = assertString(config.reporterOutputDir);
    const promises = reasons.map(async reason => {
      const subDir = path.join(outputDir, path.basename(reason.entryConfigPath, '.json'));
      await mkdir(subDir, {recursive: true});
      const xml = formatXUnitReport(reason);
      await writeFile(path.join(subDir, 'results.xml'), xml);
    });
    await Promise.all(promises);
  } else {
    // default text reporter
    console.log('');
    const msg = `${reasons.map(reason => formatTextReport(reason)).join('\n')}`;
    console.error(msg);
  }
  console.log('');
}
