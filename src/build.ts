import fs from 'fs';
import util from 'util';
import {assertString} from './assert';
import {compile, createComiplerOptionsForChunks, toCompilerOptions} from './compiler';
import {DuckConfig} from './duckconfig';
import {EntryConfig, loadEntryConfig} from './entryconfig';

export async function build(config: DuckConfig) {
  const stat = await util.promisify(fs.stat)(config.entryConfigDir);
  if (stat.isDirectory()) {
    throw new Error('Compiling all files in a directory is not yet implemented');
  }
  const entryConfig = await loadEntryConfig(config.entryConfigDir);
  if (entryConfig.modules) {
    return compileChunk(entryConfig, config);
  } else {
    return compilePage(entryConfig);
  }
}

async function compilePage(entryConfig: EntryConfig) {
  const opts = toCompilerOptions(entryConfig);
  return compile(opts);
}

async function compileChunk(entryConfig: EntryConfig, config: DuckConfig) {
  function createModuleUris(chunkId: string): string[] {
    const moduleProductionUri = assertString(entryConfig['module-production-uri']);
    return [moduleProductionUri.replace(/%s/g, chunkId)];
  }
  const {options} = await createComiplerOptionsForChunks(entryConfig, config, createModuleUris);
  return compile(options);
}
