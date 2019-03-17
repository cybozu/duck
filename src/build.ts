import fs from 'fs';
import util from 'util';
import {compile, toCompilerOptions} from './compiler';
import {DuckConfig} from './duckconfig';
import {EntryConfig, loadEntryConfig} from './entryconfig';

export async function build(config: DuckConfig) {
  const stat = await util.promisify(fs.stat)(config.entryConfigDir);
  if (stat.isDirectory()) {
    throw new Error('Compiling all files in a directory is not yet implemented');
  }
  const entryConfig = await loadEntryConfig(config.entryConfigDir);
  if (entryConfig.modules) {
    throw new Error('Compiling chunks is not yet implemented');
  } else {
    return compilePage(entryConfig);
  }
}

async function compilePage(entryConfig: EntryConfig) {
  const opts = toCompilerOptions(entryConfig);
  return compile(opts);
}
