import pLimit from 'p-limit';
import recursive from 'recursive-readdir';
import {assertString} from '../assert';
import {
  compile,
  convertToFlagfile,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from '../compiler';
import {DuckConfig} from '../duckconfig';
import {EntryConfig, loadEntryConfig} from '../entryconfig';

/**
 * @throws If compiler throws errors
 */
export async function buildJs(
  config: DuckConfig,
  entryConfigs?: readonly string[],
  printConfig = false
): Promise<any> {
  const entryConfigPaths = entryConfigs
    ? entryConfigs
    : await findEntryConfigs(assertString(config.entryConfigDir));
  const limit = pLimit(config.concurrency);
  const promises = entryConfigPaths.map(entryConfigPath =>
    limit(async () => {
      const entryConfig = await loadEntryConfig(entryConfigPath);
      if (entryConfig.modules) {
        await compileChunk(entryConfig, config, printConfig);
      } else {
        await compilePage(entryConfig, printConfig);
      }
    }).catch(e => {
      console.error(`Error: ${entryConfigPath}`);
      console.error(e);
    })
  );
  return Promise.all(promises);
}

async function findEntryConfigs(entryConfigDir: string): Promise<string[]> {
  const files = await recursive(entryConfigDir);
  return files.filter(file => /\.json$/.test(file));
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
