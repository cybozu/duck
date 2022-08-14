import { Buffer } from "buffer";
import type {
  AwsOptions,
  CleanupOptions,
  CommonOptions,
  FaastModuleProxy,
  LocalOptions,
} from "faastjs";
import { faastAws, faastLocal, log } from "faastjs";
import mergeOptions from "merge-options";
import { createRequire } from "module";
import semver from "semver";
import { assertNonNullable } from "./assert.js";
import * as compilerFaastFunctions from "./compiler-batch-wrapper.js";
import type { compileToJson } from "./compiler-core.js";
import type { DuckConfig } from "./duckconfig.js";
import { logger } from "./logger.js";

const nodeRequire = createRequire(import.meta.url);
// change to stdout
log.info.log = console.log.bind(console);

export async function createCompileFunction(config: DuckConfig): Promise<{
  compileToJson: typeof compileToJson;
  cleanup: (userCleanupOptions?: CleanupOptions) => Promise<void>;
}> {
  const faastModule = await getFaastCompiler(config);
  const cleanup = (opt?: CleanupOptions) => faastModule.cleanup(opt);
  const compile: typeof compileToJson = async (extendedOpts) => {
    const gen = faastModule.functions.compileToJsonStringChunks(extendedOpts);
    const chunks: string[] = [];
    for await (const chunk of gen) {
      logger.debug(`chunk size: ${Buffer.byteLength(chunk)}`);
      chunks.push(chunk);
    }
    return JSON.parse(chunks.join(""));
  };

  return { compileToJson: compile, cleanup };
}

async function getFaastCompiler(
  config: DuckConfig
): Promise<
  FaastModuleProxy<typeof compilerFaastFunctions, CommonOptions, any>
> {
  logger.info("Initializing batch mode");
  const batch = assertNonNullable(config.batch);
  const batchOptions = getBatchOptions(config);
  return getFaastModule(batch, batchOptions);
}

async function getFaastModule(
  batch: "aws" | "local",
  batchOptions: AwsOptions | LocalOptions
) {
  if (batch === "aws") {
    return faastAws(compilerFaastFunctions, batchOptions as AwsOptions);
  } else if (batch === "local") {
    return faastLocal(compilerFaastFunctions, batchOptions as LocalOptions);
  }
  throw new TypeError(`Unsupported batch mode: ${batch}`);
}

function getBatchOptions(config: DuckConfig): AwsOptions | LocalOptions {
  const { batchOptions = {} } = config;
  return mergeOptions.call(
    { concatArrays: true },
    defaultBatchOptions(config),
    batchOptions
  );
}

function getNativeCompilerPackageForBatch(config: DuckConfig): {
  name: string;
  version: string;
} {
  const { batch, batchAwsCustomCompiler } = config;
  if (batch === "aws" && batchAwsCustomCompiler) {
    return { ...batchAwsCustomCompiler };
  }
  const name = `google-closure-compiler-${getOsForNativeImage(config)}`;
  // This is run in local context and it (osx/windows) is probably different
  // platform from AWS (linux). `google-closure-compiler-linux` is not
  // available in macOS / Windows, so use the version of the parent package
  // `google-closure-compiler`.
  const { version } = nodeRequire("google-closure-compiler/package.json");
  const major = semver.major(version);
  return { name, version: `^${major}.0.0` };
}

function defaultBatchOptions(config: DuckConfig): AwsOptions {
  const compiler = getNativeCompilerPackageForBatch(config);
  return {
    packageJson: {
      // To suppress npm warnings
      private: true,
      dependencies: {
        [compiler.name]: compiler.version,
      },
    },
    webpackOptions: {
      externals: [
        /^aws-sdk\/?/,
        "google-closure-compiler-js",
        "google-closure-compiler-linux",
        "google-closure-compiler-osx",
        // used in google-closure-compiler/lib/(grunt|gulp)
        "chalk",
        // used in google-closure-compiler/lib/gulp
        /^gulp($|-)/,
        /^vinyl($|-)/,
      ],
    },
  };
}

function getOsForNativeImage(config: DuckConfig) {
  const { platform } = process;
  if (config.batch === "aws" || platform === "linux") {
    return "linux";
  } else if (platform === "darwin") {
    return "osx";
  }
  throw new Error(`Unsuported Platform: ${platform}`);
}
