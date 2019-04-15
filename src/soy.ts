import path from 'path';
import {DuckConfig} from './duckconfig';
import execa = require('execa');

export interface SoyToJsOptions {
  outputPathFormat: string;
  inputPrefix?: string;
  shouldGenerateGoogMsgDefs?: boolean;
  shouldGenerateJsdoc?: boolean;
  shouldProvideRequireSoyNamespaces?: boolean;
  bidiGlobalDir?: 1 | -1;
  pluginModules?: readonly string[];
}

type SoyConfig = Required<Pick<DuckConfig, 'soyJarPath' | 'soyOptions'>>;

export async function compileSoy(
  soyFiles: readonly string[],
  config: SoyConfig,
  printConfig = false
): Promise<void> {
  const soyArgs = toSoyArgs(soyFiles, config);
  if (printConfig) {
    console.log(soyArgs);
    return;
  }
  await execa('java', soyArgs);
}

export function toSoyArgs(
  soyFiles: readonly string[],
  {soyJarPath, soyOptions}: SoyConfig
): string[] {
  const args = ['-classpath', soyJarPath, 'com.google.template.soy.SoyToJsSrcCompiler'];
  Object.entries(soyOptions).forEach(([key, value]) => {
    if (typeof value === 'boolean' && value) {
      args.push(`--${key}`);
    } else if (typeof value === 'string' || typeof value === 'number') {
      args.push(`--${key}`, String(value));
    } else if (Array.isArray(value)) {
      args.push(`--${key}`, value.join(','));
    } else {
      throw new TypeError(`Unsupported soy config value: "${key}: ${value}"`);
    }
  });
  if (soyOptions.inputPrefix) {
    const {inputPrefix} = soyOptions;
    soyFiles = soyFiles.map(filepath => path.relative(inputPrefix, filepath));
  }
  args.push('--srcs', soyFiles.join(','));
  return args;
}
