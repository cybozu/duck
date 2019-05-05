import pLimit from 'p-limit';
import pSettled from 'p-settle';
import path from 'path';
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
import {restoreDepsJs} from '../gendeps';
import {logger} from '../logger';

/**
 * @throws If compiler throws errors
 */
export async function buildJs(
  config: DuckConfig,
  entryConfigs?: readonly string[],
  printConfig = false
): Promise<any> {
  let depsJsRestored = false;
  const entryConfigPaths = entryConfigs
    ? entryConfigs
    : (await findEntryConfigs(assertString(config.entryConfigDir))).sort();
  const limit = pLimit(config.concurrency);
  let count = 0;
  const promises = entryConfigPaths.map(entryConfigPath =>
    limit(async () => {
      const entryConfig = await loadEntryConfig(entryConfigPath);
      const id = count++;
      logCompiling(entryConfigPath, id);
      try {
        if (entryConfig.modules) {
          if (config.depsJs && !depsJsRestored) {
            logger.info('Restoring deps.js cache');
            await restoreDepsJs(config.depsJs, config.closureLibraryDir);
            depsJsRestored = true;
          }
          await compileChunk(entryConfig, config, printConfig);
        } else {
          await compilePage(entryConfig, printConfig);
        }
      } catch (e) {
        logFailed(entryConfigPath, id);
        throw e;
      }
    })
  );

  await waitAllAndThrowIfAnyCompilationsFailed(promises, entryConfigPaths);

  function logCompiling(entryConfigPath: string, id: number): void {
    const countStatus = entryConfigPaths.length > 1 ? `[${id}/${entryConfigPaths.length}] ` : '';
    const relativePath = path.relative(process.cwd(), entryConfigPath);
    logger.info(`${countStatus}Compiling ${relativePath}`);
  }
  function logFailed(entryConfigPath: string, id: number): void {
    const countStatus = entryConfigPaths.length > 1 ? `[${id}/${entryConfigPaths.length}] ` : '';
    const relativePath = path.relative(process.cwd(), entryConfigPath);
    logger.error(`${countStatus}Failed ${relativePath}`);
  }
}

/**
 * Wait until all promises for compilation are setteld and throw
 * a `BuildJsCompilationError` if some promises failed.
 *
 * @throws BuildJsCompilationError
 */
async function waitAllAndThrowIfAnyCompilationsFailed(
  promises: readonly Promise<void>[],
  entryConfigPaths: readonly string[]
): Promise<void> {
  const results = await pSettled(promises);
  const reasons: string[] = results
    .map((result, idx) => {
      return {
        ...result,
        entryConfigPath: entryConfigPaths[idx],
      };
    })
    .filter(result => result.isRejected)
    .map(result => {
      if (!result.isRejected) {
        throw new Error('Unexpected state');
      }
      return `Compile Errors in ${result.entryConfigPath}:\n\n${(result.reason as Error).message}`;
    });
  if (reasons.length > 0) {
    throw new BuildJsCompilationError(reasons, results.length);
  }
}

export class BuildJsCompilationError extends Error {
  reasons: readonly string[];
  constructor(reasons: readonly string[], totalSize: number) {
    super(`Failed to compile (${reasons.length}/${totalSize})`);
    this.name = 'BuildJsCompilationError';
    this.reasons = reasons;
  }
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
    // TODO: The last two lines are removed in listr.
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
    // TODO: The last two lines are removed in listr.
    console.log(options);
    return;
  }
  return compile(convertToFlagfile(options));
}
