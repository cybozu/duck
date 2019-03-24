import fs from 'fs';
import util from 'util';
import {assertString} from './assert';
import {
  compile,
  convertToFlagfile,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from './compiler';
import {DuckConfig} from './duckconfig';
import {EntryConfig, loadEntryConfig} from './entryconfig';

/**
 * @throws If compiler throws errors
 */
export async function buildJs(config: DuckConfig, printConfig = false) {
  const stat = await util.promisify(fs.stat)(config.entryConfigDir);
  if (stat.isDirectory()) {
    throw new Error('Compiling all files in a directory is not yet implemented');
  }
  const entryConfig = await loadEntryConfig(config.entryConfigDir);
  if (entryConfig.modules) {
    return compileChunk(entryConfig, config, printConfig);
  } else {
    return compilePage(entryConfig, printConfig);
  }
}

/**
 * @throws If compiler throws errors
 */
async function compilePage(entryConfig: EntryConfig, printConfig = false): Promise<any> {
  const opts = createCompilerOptionsForPage(entryConfig, true);
  if (printConfig) {
    console.log(opts);
    return;
  }
  return compile(opts);
}

/**
 * @throws If compiler throws errors
 */
async function compileChunk(
  entryConfig: EntryConfig,
  config: DuckConfig,
  printConfig = false
): Promise<any> {
  function createModuleUris(chunkId: string): string[] {
    const moduleProductionUri = assertString(entryConfig['module-production-uri']);
    return [moduleProductionUri.replace(/%s/g, chunkId)];
  }
  const {options} = await createCompilerOptionsForChunks(
    entryConfig,
    config,
    true,
    createModuleUris
  );
  if (printConfig) {
    console.log(options);
    return;
  }
  return compile(convertToFlagfile(options));
}
