import {DuckConfig} from './duckconfig';
import recursive from 'recursive-readdir';
import flat from 'array.prototype.flat';
import execa = require('execa');
import path from 'path';

type SoyConfig = Pick<DuckConfig, 'soyFileRoots' | 'soyJarPath' | 'soyOptions'>;

export async function buildSoy(config: SoyConfig, printConfig = false) {
  const soyFiles = await findSoyFiles(config);
  const soyArgs = toSoyArgs(soyFiles, config);
  if (printConfig) {
    console.log(soyArgs);
    return;
  }
  await execa('java', soyArgs);
}

export function toSoyArgs(soyFiles: string[], config: SoyConfig): string[] {
  const args = ['-classpath', config.soyJarPath, 'com.google.template.soy.SoyToJsSrcCompiler'];
  Object.entries(config.soyOptions).forEach(([key, value]) => {
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
  if (config.soyOptions.inputPrefix) {
    const {inputPrefix} = config.soyOptions;
    soyFiles = soyFiles.map(filepath => path.relative(inputPrefix, filepath));
  }
  args.push('--srcs', soyFiles.join(','));
  return args;
}

async function findSoyFiles(config: SoyConfig) {
  const soyFilePromises = config.soyFileRoots.map(async p => {
    const files = await recursive(p);
    return files.filter(file => /\.soy$/.test(file));
  });
  const soyFiles = flat(await Promise.all(soyFilePromises));
  return soyFiles;
}
