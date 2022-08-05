import {
  AwsOptions,
  CommonOptions,
  faastAws,
  faastLocal,
  FaastModuleProxy,
  LocalOptions,
  log,
} from "faastjs";
import mergeOptions from "merge-options";
import semver from "semver";
import { assertNonNullable } from "./assert";
import * as compilerFaastFunctions from "./compiler-core";
import { DuckConfig } from "./duckconfig";
import { logger } from "./logger";

// change to stdout
log.info.log = console.log.bind(console);

export async function getFaastCompiler(
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
  const { version } = require("google-closure-compiler/package.json");
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
