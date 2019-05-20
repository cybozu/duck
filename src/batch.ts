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

export async function getFaastCompiler(
  config: DuckConfig
): Promise<FaastModuleProxy<typeof compilerFaastFunctions, CommonOptions, any>> {
  const m = process.env.AWS
    ? await faastAws(compilerFaastFunctions, config.batchOptions as AwsOptions)
    : await faastLocal(compilerFaastFunctions, config.batchOptions as LocalOptions);
  return m;
}
