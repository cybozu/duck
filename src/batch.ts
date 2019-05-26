import {
  AwsOptions,
  CommonOptions,
  faastAws,
  faastLocal,
  FaastModuleProxy,
  LocalOptions,
} from 'faastjs';
import * as compilerFaastFunctions from './compiler-core';
import {DuckConfig} from './duckconfig';
import {logger} from './logger';

export async function getFaastCompiler(
  config: DuckConfig
): Promise<FaastModuleProxy<typeof compilerFaastFunctions, CommonOptions, any>> {
  logger.info('Initializing batch mode');
  const batchOptions = getBatchOptions(config);
  const m = process.env.AWS
    ? await faastAws(compilerFaastFunctions, batchOptions as AwsOptions)
    : await faastLocal(compilerFaastFunctions, batchOptions as LocalOptions);
  return m;
}

function getBatchOptions(config: DuckConfig): AwsOptions | LocalOptions {
  const {batchOptions = {}} = config;
  if (!batchOptions.webpackOptions) {
    batchOptions.webpackOptions = {};
  }
  if (!batchOptions.webpackOptions.externals) {
    batchOptions.webpackOptions.externals = [];
  }
  if (!Array.isArray(batchOptions.webpackOptions.externals)) {
    batchOptions.webpackOptions.externals = [batchOptions.webpackOptions.externals];
  }
  batchOptions.webpackOptions.externals = [
    ...batchOptions.webpackOptions.externals,
    ...defaultWebpackExternals(),
  ];
  return batchOptions;
}

function defaultWebpackExternals(): import('webpack').ExternalsElement[] {
  return [
    /^aws-sdk\/?/,
    'google-closure-compiler-js',
    'google-closure-compiler-linux',
    'google-closure-compiler-osx',
    // used in google-closure-compiler/lib/(grunt|gulp)
    'chalk',
    // used in google-closure-compiler/lib/gulp
    /^gulp($|-)/,
    /^vinyl($|-)/,
  ];
}
