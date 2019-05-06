import pLimit from 'p-limit';
import pSettled from 'p-settle';
import path from 'path';
import recursive from 'recursive-readdir';
import {assertString} from '../assert';
import {resultInfoLogType} from '../cli';
import {
  compile,
  CompilerOptions,
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
      let options: CompilerOptions;
      if (entryConfig.modules) {
        if (config.depsJs && !depsJsRestored) {
          logger.info('Restoring deps.js cache');
          await restoreDepsJs(config.depsJs, config.closureLibraryDir);
          depsJsRestored = true;
        }
        options = await createCompilerOptionsForChunks_(entryConfig, config);
      } else {
        options = createCompilerOptionsForPage(entryConfig, true);
      }

      if (printConfig) {
        logger.info({
          msg: 'Print config only',
          type: resultInfoLogType,
          title: 'Compiler config',
          bodyObject: options,
        });
        return;
      }

      try {
        await compile(options);
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

async function createCompilerOptionsForChunks_(
  entryConfig: EntryConfig,
  config: DuckConfig
): Promise<CompilerOptions> {
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
  return options;
}
