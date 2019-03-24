import flat from 'array.prototype.flat';
import recursive from 'recursive-readdir';
import {DuckConfig} from '../duckconfig';
import {compileSoy} from '../soy';

type BuildSoyConfig = Pick<DuckConfig, 'soyFileRoots' | 'soyJarPath' | 'soyOptions'>;

export async function buildSoy(config: BuildSoyConfig, printConfig = false): Promise<void> {
  const soyFiles = await findSoyFiles(config);
  return compileSoy(soyFiles, config, printConfig);
}

async function findSoyFiles(config: BuildSoyConfig): Promise<string[]> {
  const soyFilePromises = config.soyFileRoots.map(async p => {
    const files = await recursive(p);
    return files.filter(file => /\.soy$/.test(file));
  });
  const soyFiles = flat(await Promise.all(soyFilePromises));
  return soyFiles;
}
