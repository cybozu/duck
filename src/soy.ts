import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import util from 'util';
import {resultInfoLogType} from './cli';
import {DuckConfig} from './duckconfig';
import {logger} from './logger';
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
    logger.info({
      msg: 'Print config only',
      type: resultInfoLogType,
      title: 'Soy config',
      bodyObject: soyArgs,
    });
    return;
  }
  logger.info('Compiling soy templates');
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

export type SoyWatchConfig = Required<
  Pick<DuckConfig, 'soyFileRoots' | 'soyJarPath' | 'soyOptions'>
>;

export function watchSoy(config: SoyWatchConfig) {
  const watcher = chokidar.watch(config.soyFileRoots.map(p => `${p}/**/*.soy`), {
    ignoreInitial: true,
  });
  watcher.on('ready', () => logger.info('Ready for watching Soy templates...'));
  watcher.on('error', logger.error.bind(logger));
  watcher.on('add', handleSoyUpdated.bind(null, config));
  watcher.on('change', handleSoyUpdated.bind(null, config));
  watcher.on('unlink', handleSoyDeleted.bind(null, config));
}

async function handleSoyUpdated(config: SoyConfig, filepath: string) {
  logger.info(`[SOY_UPDATED]: ${filepath}`);
  return compileSoy([filepath], config);
}

async function handleSoyDeleted(config: SoyConfig, filepath: string) {
  logger.info(`[SOY_DELETED]: ${filepath}`);
  const outputPath = calcOutputPath(filepath, config);
  await util.promisify(fs.unlink)(outputPath);
  logger.info(`[REMOVED]: ${outputPath}`);
}

/**
 * TODO: support {LOCALE} and {LOCALE_LOWER_CASE}
 */
function calcOutputPath(inputPath: string, config: SoyConfig) {
  const {outputPathFormat, inputPrefix} = config.soyOptions;
  let outputPath = outputPathFormat;
  let inputDirectory = path.dirname(inputPath);
  if (inputPrefix) {
    inputDirectory = path.relative(inputPrefix, inputDirectory);
    outputPath = outputPath.replace('{INPUT_PREFIX}', inputPrefix);
  }
  const filename = path.basename(inputPath);
  const filenameNoExt = filename.slice(0, -path.extname(filename).length);
  return outputPath
    .replace('{INPUT_DIRECTORY}', inputDirectory)
    .replace('{INPUT_FILE_NAME}', filename)
    .replace('{INPUT_FILE_NAME_NO_EXT}', filenameNoExt);
}
