import path from 'path';
import {assertString} from './assert';
import {SoyToJsOptions} from './soy';

export interface DuckConfig {
  closureLibraryDir: string;
  inputsRoot: string;
  entryConfigDir: string;
  soyJarPath?: string;
  soyOptions?: SoyToJsOptions;
  soyFileRoots?: string[];
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
    toAbsPath(config, configDir, 'closureLibraryDir');
    toAbsPath(config, configDir, 'inputsRoot');
    toAbsPath(config, configDir, 'entryConfigDir');
    toAbsPath(config, configDir, 'soyJarPath');
    if (config.soyFileRoots) {
      config.soyFileRoots = config.soyFileRoots.map(root => path.resolve(configDir, root));
    }
    if (config.soyOptions) {
      const {inputPrefix} = config.soyOptions;
      if (inputPrefix) {
        toAbsPath(config.soyOptions, configDir, 'inputPrefix');
        // path.resolve() removes a trailing separator,
        // but it's important for `inputPrefix`.
        if (inputPrefix.endsWith(path.sep)) {
          config.soyOptions.inputPrefix += path.sep;
        }
      }
    }
    result = {...config, ...opts};
  } catch {
    if (opts.config) {
      throw new Error(`duck.config not found: ${opts.config}`);
    }
  }

  return result;
}

function toAbsPath<T>(config: T, baseDir: string, key: PickKeysByValue<Required<T>, string>) {
  const value = config[key];
  if (typeof value === 'string') {
    // "as any": TypeScript can not handle conditional type
    config[key] = path.resolve(baseDir, value) as any;
  }
}

/**
 * @example
 * type Props = {name: string; age: number; visible: boolean};
 * // Keys: 'name' | 'age'
 * type Keys = PickKeysByValue<Props, string | number>;
 */
type PickKeysByValue<T, ValueType> = {
  [Key in keyof T]: T[Key] extends ValueType ? Key : never
}[keyof T];
