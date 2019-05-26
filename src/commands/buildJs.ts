import fs from 'fs';
import pLimit from 'p-limit';
import pSettled from 'p-settle';
import path from 'path';
import recursive from 'recursive-readdir';
import {promisify} from 'util';
import {assertString} from '../assert';
import {resultInfoLogType} from '../cli';
import {
  CompilerOptions,
  compileToJson,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from '../compiler';
import * as compilerFaastFunctions from '../compiler-core';
import {DuckConfig} from '../duckconfig';
import {EntryConfig, loadEntryConfig} from '../entryconfig';
import {restoreDepsJs} from '../gendeps';
import {logger} from '../logger';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * @throws If compiler throws errors
 */
export async function buildJs(
  config: DuckConfig,
  entryConfigs?: readonly string[],
  printConfig = false
): Promise<any> {
  let compileFn = compileToJson;
  let faastModule:
    | import('faastjs').FaastModuleProxy<
        typeof compilerFaastFunctions,
        import('faastjs').CommonOptions,
        any
      >
    | null = null;
  if (config.batch) {
    config.compilerPlatform = 'native';
    const {getFaastCompiler} = await import('../batch');
    faastModule = await getFaastCompiler(config);
    compileFn = faastModule.functions.compileToJson;
  }
  let depsJsRestored = false;
  const entryConfigPaths = entryConfigs
    ? entryConfigs
    : (await findEntryConfigs(assertString(config.entryConfigDir))).sort();
  const limit = pLimit(config.concurrency || 1);
  let runningJobCount = 1;
  let completedJobCount = 1;
  const promises = entryConfigPaths.map(entryConfigPath =>
    limit(async () => {
      try {
        const entryConfig = await loadEntryConfig(entryConfigPath);
        let options: CompilerOptions;
        if (entryConfig.modules) {
          if (config.depsJs && !depsJsRestored) {
            log(entryConfigPath, 'Restoring deps.js cache');
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

        if (config.batch) {
          convertCompilerOptionsToRelative(options, process.cwd());
        }
        logWithCount(entryConfigPath, runningJobCount++, 'Compiling');
        const outputs = await compileFn(options, config.compilerPlatform === 'native');
        const promises = outputs.map(async output => {
          await mkdir(path.dirname(output.path), {recursive: true});
          return writeFile(output.path, output.src);
        });
        await Promise.all(promises);
        logWithCount(entryConfigPath, completedJobCount++, 'Compiled');
      } catch (e) {
        logWithCount(entryConfigPath, completedJobCount++, 'Failed');
        throw e;
      }
    })
  );

  try {
    await waitAllAndThrowIfAnyCompilationsFailed(promises, entryConfigPaths);
  } finally {
    if (faastModule) {
      faastModule.cleanup({deleteResources: false});
    }
  }

  function log(entryConfigPath: string, msg: string): void {
    const relativePath = path.relative(process.cwd(), entryConfigPath);
    logger.info(`${msg}: ${relativePath}`);
  }
  function logWithCount(entryConfigPath: string, count: number, msg: string): void {
    log(entryConfigPath, `[${count}/${entryConfigPaths.length}] ${msg}`);
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

function convertCompilerOptionsToRelative(options: CompilerOptions, basepath: string): void {
  if (options.js) {
    options.js = options.js.map(file => {
      if (file.startsWith('!')) {
        return `!${path.relative(basepath, file.slice(1))}`;
      } else {
        return path.relative(basepath, file);
      }
    });
  }
  if (options.externs) {
    options.externs = options.externs.map(file => path.relative(basepath, file));
  }
  if (options.entry_point) {
    options.entry_point = options.entry_point.map(file => path.relative(basepath, file));
  }
}
