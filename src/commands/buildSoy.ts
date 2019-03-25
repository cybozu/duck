import flat from 'array.prototype.flat';
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
