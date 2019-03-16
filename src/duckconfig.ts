import path from 'path';
import {assertString} from './assert';

export interface DuckConfig {
  closureLibraryDir: string;
  inputsRoot: string;
  entryConfigDir: string;
  host: string;
  port: number;
}

/**
 * @param opts opts.config is path to duck.config.js
 */
export function loadConfig(opts: any = {}): DuckConfig {
  let configPath = path.join(process.cwd(), 'duck.config');
  if (opts.config) {
    configPath = assertString(opts.config);
  }
  let result = opts;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config: DuckConfig = require(configPath);
    const configDir = path.dirname(configPath);
    // resolve relative path to absolute
    config.closureLibraryDir = path.resolve(configDir, config.closureLibraryDir);
    config.inputsRoot = path.resolve(configDir, config.inputsRoot);
    config.entryConfigDir = path.resolve(configDir, config.entryConfigDir);
    result = {...config, ...opts};
  } catch {
    if (opts.config) {
      throw new Error(`duck.config not found: ${opts.config}`);
    }
  }

  return result;
}
