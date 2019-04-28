import flat from 'array.prototype.flat';
import chokidar from 'chokidar';
import {promises as fs} from 'fs';
import path from 'path';
import recursive from 'recursive-readdir';
import {DuckConfig} from '../duckconfig';
import {compileSoy} from '../soy';

export type BuildSoyConfig = Required<
  Pick<DuckConfig, 'soyFileRoots' | 'soyJarPath' | 'soyOptions'>
>;

/**
 * @param config
 * @param printConfig Print only
 * @return An array of input Soy template filepaths
 */
export async function buildSoy(config: BuildSoyConfig, printConfig = false): Promise<string[]> {
  const soyFiles = await findSoyFiles(config);
  await compileSoy(soyFiles, config, printConfig);
  return soyFiles;
}

async function findSoyFiles(config: BuildSoyConfig): Promise<string[]> {
  const soyFilePromises = config.soyFileRoots.map(async p => {
    const files = await recursive(p);
    return files.filter(file => /\.soy$/.test(file));
  });
  const soyFiles = flat(await Promise.all(soyFilePromises));
  return soyFiles;
}

export function watchSoy(config: BuildSoyConfig) {
  const watcher = chokidar.watch(config.soyFileRoots.map(p => `${p}/**/*.soy`), {
    ignoreInitial: true,
  });
  watcher.on('ready', () => console.log('Ready for watching Soy templates...'));
  watcher.on('error', console.error);
  watcher.on('add', handleSoyUpdated.bind(null, config));
  watcher.on('change', handleSoyUpdated.bind(null, config));
  watcher.on('unlink', handleSoyDeleted.bind(null, config));
}

async function handleSoyUpdated(config: BuildSoyConfig, filepath: string) {
  console.log(`[SOY_UPDATED]: ${filepath}`);
  return compileSoy([filepath], config);
}

async function handleSoyDeleted(config: BuildSoyConfig, filepath: string) {
  console.log(`[SOY_DELETED]: ${filepath}`);
  const outputPath = calcOutputPath(filepath, config);
  await fs.unlink(outputPath);
  console.log(`[REMOVED]: ${outputPath}`);
}

/**
 * TODO: support {LOCALE} and {LOCALE_LOWER_CASE}
 */
function calcOutputPath(inputPath: string, config: BuildSoyConfig) {
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
