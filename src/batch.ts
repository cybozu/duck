import {
  AwsOptions,
  CommonOptions,
  faastAws,
  faastLocal,
  FaastModuleProxy,
  LocalOptions,
  log,
} from 'faastjs';
import mergeOptions from 'merge-options';
import {assertNonNullable} from './assert';
import * as compilerFaastFunctions from './compiler-core';
import {DuckConfig} from './duckconfig';
import {logger} from './logger';

// change to stdout
log.info.log = console.log.bind(console);

export async function getFaastCompiler(
  config: DuckConfig
): Promise<FaastModuleProxy<typeof compilerFaastFunctions, CommonOptions, any>> {
  logger.info('Initializing batch mode');
  const batch = assertNonNullable(config.batch);
  const batchOptions = getBatchOptions(config);
  const m =
    batch === 'aws'
      ? await faastAws(compilerFaastFunctions, batchOptions as AwsOptions)
      : batch === 'local'
      ? await faastLocal(compilerFaastFunctions, batchOptions as LocalOptions)
      : null;
  if (!m) {
    throw new TypeError(`Unsupported batch mode: ${batch}`);
  }
  return m;
}

function getBatchOptions(config: DuckConfig): AwsOptions | LocalOptions {
  const {batchOptions = {}} = config;
  return mergeOptions.call({concatArrays: true}, defaultBatchOptions(config), batchOptions);
}

function defaultBatchOptions(config: DuckConfig): AwsOptions {
  const closureVersion = require('google-closure-compiler/package.json').version;
  return {
    packageJson: {
      // To suppress npm warnings
      private: true,
      dependencies: {
        [`google-closure-compiler-${getOsForNativeImage(config)}`]: closureVersion,
      },
    },
    webpackOptions: {
      externals: [
        /^aws-sdk\/?/,
        'google-closure-compiler-js',
        'google-closure-compiler-linux',
        'google-closure-compiler-osx',
        // used in google-closure-compiler/lib/(grunt|gulp)
        'chalk',
        // used in google-closure-compiler/lib/gulp
        /^gulp($|-)/,
        /^vinyl($|-)/,
      ],
    },
  };
}

function getOsForNativeImage(config: DuckConfig) {
  const {platform} = process;
  if (config.batch === 'aws' || platform === 'linux') {
    return 'linux';
  } else if (platform === 'darwin') {
    return 'osx';
  } else {
    throw new Error(`Unsuported Platform: ${platform}`);
  }
}
