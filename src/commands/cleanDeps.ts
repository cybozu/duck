import rimraf from 'rimraf';
import util from 'util';

export async function cleanDeps(depsJsPath: string): Promise<void> {
  console.debug(`rm ${depsJsPath}`);
  return util.promisify(rimraf)(depsJsPath);
}
