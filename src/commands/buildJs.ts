import { strict as assert } from "assert";
import type { CleanupOptions } from "faastjs";
import { FaastError } from "faastjs";
import { promises as fs } from "fs";
import pSettled from "p-settle";
import path from "path";
import recursive from "recursive-readdir";
import { assertString } from "../assert.js";
import { resultInfoLogType } from "../cli.js";
import type * as compilerCoreFunctions from "../compiler-core.js";
import {
  CompilerError,
  compileToJson,
  createCompilerOptionsForChunks,
  createCompilerOptionsForPage,
} from "../compiler.js";
import type { DuckConfig } from "../duckconfig.js";
import type { EntryConfig } from "../entryconfig.js";
import { loadEntryConfig } from "../entryconfig.js";
import { restoreDepsJs } from "../gendeps.js";
import { logger } from "../logger.js";
import type { CompileErrorItem, ErrorReason } from "../report.js";

/**
 * @throws If compiler throws errors
 */
export async function buildJs(
  config: DuckConfig,
  entryConfigs?: readonly string[],
  printConfig = false
): Promise<ErrorReason[]> {
  let compileFn = compileToJson;
  let cleanup: ((opt?: CleanupOptions) => Promise<void>) | null = null;
  if (config.batch) {
    const { createCompileFunction } = await import("../batch.js");
    const func = await createCompileFunction(config);
    compileFn = func.compileToJson;
    cleanup = func.cleanup;
  }
  let restoringDepsJs: Promise<void> | null = null;
  const entryConfigPaths = entryConfigs
    ? entryConfigs
    : (
        await findEntryConfigs(
          assertString(config.entryConfigDir, '"entryConfigDir" is required')
        )
      ).sort();
  let runningJobCount = 1;
  let completedJobCount = 1;
  const compileFunctions = entryConfigPaths.map(
    (entryConfigPath) => async () => {
      try {
        const entryConfig = await loadEntryConfig(entryConfigPath);
        let options: compilerCoreFunctions.ExtendedCompilerOptions;
        if (entryConfig.chunks) {
          if (config.depsJs) {
            if (!restoringDepsJs) {
              restoringDepsJs = restoreDepsJs(
                config.depsJs,
                config.closureLibraryDir
              );
            }
            await restoringDepsJs;
          }
          options = await createCompilerOptionsForChunks_(entryConfig, config);
        } else {
          options = createCompilerOptionsForPage(entryConfig, config, true);
        }

        if (printConfig) {
          logger.info({
            msg: "Print config only",
            type: resultInfoLogType,
            title: "Compiler config",
            bodyObject: options,
          });
          return;
        }

        logWithCount(entryConfigPath, runningJobCount++, "Compiling");
        const [outputs, warnings] = await compileFn(options);
        const promises = outputs.map(async (output) => {
          await fs.mkdir(path.dirname(output.path), { recursive: true });
          return fs.writeFile(output.path, output.src);
        });
        await Promise.all(promises);
        logWithCount(entryConfigPath, completedJobCount++, "Compiled");
        return warnings;
      } catch (e) {
        logWithCount(entryConfigPath, completedJobCount++, "Failed");
        throw e;
      }
    }
  );

  try {
    return await waitAllAndThrowIfAnyCompilationsFailed(
      compileFunctions,
      entryConfigPaths,
      config
    );
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }

  function log(entryConfigPath: string, msg: string): void {
    const relativePath = path.relative(process.cwd(), entryConfigPath);
    logger.info(`${msg}: ${relativePath}`);
  }
  function logWithCount(
    entryConfigPath: string,
    count: number,
    msg: string
  ): void {
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
  compileFunctions: ReadonlyArray<
    () => Promise<CompileErrorItem[] | undefined>
  >,
  entryConfigPaths: readonly string[],
  config: DuckConfig
): Promise<ErrorReason[]> {
  const results = await pSettled(compileFunctions, {
    concurrency: config.concurrency || 1,
  });
  const reasons: ErrorReason[] = results
    .map((result, idx) => ({
      ...result,
      entryConfigPath: entryConfigPaths[idx],
    }))
    .map((result) => {
      if (result.isFulfilled) {
        // no errors, but it may contain warnings
        return {
          entryConfigPath: result.entryConfigPath,
          command: null,
          items: result.value || [],
        };
      }
      // has some errors
      const reason = result.reason as any;
      try {
        const { command, items } = parseErrorReason(reason, config);
        return {
          entryConfigPath: result.entryConfigPath,
          command,
          items,
        };
      } catch {
        // for invalid compiler options errors
        throw new Error(`Unexpected non-JSON error: ${reason.message}`);
      }
    })
    .filter((result) => result.items.length > 0);
  if (results.filter((result) => result.isRejected).length > 0) {
    throw new BuildJsCompilationError(reasons, results.length);
  }
  return reasons;

  function parseErrorReason(
    reason: any,
    config: DuckConfig
  ): { command: string; items: CompileErrorItem[] } {
    let message: string;
    if (config.batch) {
      assert(reason instanceof FaastError);
      assert.equal(reason.name, "CompilerError");
      // In batch mode, faast.js surrounds an error with a FaastError that
      // is a subclass of VError. `.jse_shortmsg` is a property of VError for
      // debug. The original error message is only stored this prop.
      // `.message` is transformed into a string concatenated with `cause`,
      // so it cannot be used.
      // https://github.com/TritonDataCenter/node-verror/blob/v1.10.1/lib/verror.js#L167-L172
      message = (reason as any).jse_shortmsg;
    } else if (reason instanceof CompilerError) {
      message = reason.message;
    } else {
      throw new TypeError(`reason is an unexpected error`);
    }
    const [command, , ...messages] = message.split("\n");
    return { command, items: JSON.parse(messages.join("\n")) };
  }
}
export class BuildJsCompilationError extends Error {
  reasons: readonly ErrorReason[];
  constructor(reasons: readonly ErrorReason[], totalSize: number) {
    super(`Failed to compile (${reasons.length}/${totalSize})`);
    this.name = "BuildJsCompilationError";
    this.reasons = reasons;
  }
}

async function findEntryConfigs(entryConfigDir: string): Promise<string[]> {
  const files = await recursive(entryConfigDir);
  return files.filter((file) => /\.json$/.test(file));
}

async function createCompilerOptionsForChunks_(
  entryConfig: EntryConfig,
  config: DuckConfig
): Promise<compilerCoreFunctions.ExtendedCompilerOptions> {
  function createChunkUris(chunkId: string): string[] {
    const chunkProductionUri = assertString(
      entryConfig["chunk-production-uri"]
    );
    return [chunkProductionUri.replace(/%s/g, chunkId)];
  }
  const { options } = await createCompilerOptionsForChunks(
    entryConfig,
    config,
    true,
    createChunkUris
  );
  return options;
}
