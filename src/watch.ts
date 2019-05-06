import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import util from 'util';
import {clearEntryIdToChunkCache} from './commands/serve';
import {DuckConfig} from './duckconfig';
import {removeDepCacheByPath} from './gendeps';
import {logger} from './logger';
import {compileSoy} from './soy';

const chokidarEvents = ['add', 'change', 'unlink'] as const;

export function watchJsAndSoy(config: DuckConfig) {
  let target = 'JS';
  const paths = [`${config.inputsRoot}/**/*.js`];
  const {soyJarPath, soyFileRoots, soyOptions} = config;
  let soyConfig: SoyConfig | null = null;
  if (soyJarPath && soyFileRoots && soyOptions) {
    soyConfig = {soyJarPath, soyOptions};
    paths.push(...soyFileRoots.map(p => `${p}/**/*.soy`));
    target = 'JS and Soy';
  }
  const watcher = chokidar.watch(paths, {
    ignoreInitial: true,
  });
  watcher.on('ready', () => logger.info(`Watching for ${target} file changes...`));
  watcher.on('error', logger.error.bind(logger));
  chokidarEvents.forEach(event => {
    watcher.on(event, handleChokidarEvent.bind(null, event, soyConfig));
  });
}

function handleChokidarEvent(
  event: typeof chokidarEvents[number],
  config: SoyConfig | null,
  filepath: string
): void {
  if (/\.js$/.test(filepath)) {
    jsHandlers[event](filepath);
  } else if (config && /\.soy$/.test(filepath)) {
    soyHandlers[event](config, filepath);
  }
}

const jsHandlers = {
  add: handleJsUpdated,
  change: handleJsUpdated,
  unlink: handleJsUpdated,
} as const;

function handleJsUpdated(filepath: string) {
  logger.info(`[JS_UPDATED]: ${filepath}`);
  clearEntryIdToChunkCache();
  removeDepCacheByPath(filepath);
}

const soyHandlers = {
  add: handleSoyUpdated,
  change: handleSoyUpdated,
  unlink: handleSoyDeleted,
} as const;

type SoyConfig = Required<Pick<DuckConfig, 'soyJarPath' | 'soyOptions'>>;

async function handleSoyUpdated(config: SoyConfig, filepath: string) {
  logger.info(`[SOY_UPDATED]: ${filepath}`);
  return compileSoy([filepath], config);
}

async function handleSoyDeleted(config: SoyConfig, filepath: string) {
  logger.info(`[SOY_DELETED]: ${filepath}`);
  const outputPath = calcOutputPath(filepath, config);
  await util.promisify(fs.unlink)(outputPath);
  logger.info(`Removed: ${outputPath}`);
}

/**
 * TODO: support {LOCALE} and {LOCALE_LOWER_CASE}
 */
function calcOutputPath(inputPath: string, config: Required<Pick<DuckConfig, 'soyOptions'>>) {
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
