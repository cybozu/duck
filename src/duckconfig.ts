import compilerPakageJson from "google-closure-compiler/package.json";
import path from "path";
import semver from "semver";
import { assertString } from "./assert";
import { JsonReporterOptions } from "./reporters/json-reporter";
import { TextReporterOptions } from "./reporters/text-reporter";
import { XUnitReporterOptions } from "./reporters/xunit-reporter";
import { SoyToJsOptions } from "./soy";

export interface DuckConfig {
  closureLibraryDir: string;
  inputsRoot: string;
  depsJs?: string;
  depsJsIgnoreDirs: readonly string[];
  depsWorkers?: number;
  entryConfigDir: string;
  soyJarPath?: string;
  soyOptions?: SoyToJsOptions;
  soyFileRoots?: readonly string[];
  concurrency?: number;
  batch?: "aws" | "local";
  strict?: boolean;
  batchOptions?: import("faastjs").AwsOptions | import("faastjs").LocalOptions;
  reporters?: ("json" | "text" | "xunit")[];
  reporterOptions?: {
    json?: JsonReporterOptions;
    text?: TextReporterOptions;
    xunit?: XUnitReporterOptions;
  };
  host: string;
  port: number;
  http2?: boolean;
  https?: {
    keyPath: string;
    certPath: string;
  };
}

/**
 * @param opts opts.config is path to duck.config.js
 */
export function loadConfig(opts: any = {}): DuckConfig {
  let configPath = path.join(process.cwd(), "duck.config");
  if (opts.config) {
    configPath = assertString(opts.config);
  }
  let result: DuckConfig = opts;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config: DuckConfig = require(configPath);
    const configDir = path.dirname(configPath);
    // resolve relative path to absolute
    toAbsPath(config, configDir, "closureLibraryDir");
    toAbsPath(config, configDir, "inputsRoot");
    toAbsPath(config, configDir, "entryConfigDir");
    toAbsPath(config, configDir, "soyJarPath");
    toAbsPath(config, configDir, "depsJs");
    toAbsPathArray(config, configDir, "depsJsIgnoreDirs");
    config.depsJsIgnoreDirs = config.depsJsIgnoreDirs || [];
    toAbsPathArray(config, configDir, "soyFileRoots");
    if (config.soyOptions) {
      const { inputPrefix } = config.soyOptions;
      if (inputPrefix) {
        toAbsPath(config.soyOptions, configDir, "inputPrefix");
        // path.resolve() removes a trailing separator,
        // but it's important for `inputPrefix`.
        if (inputPrefix.endsWith(path.sep)) {
          config.soyOptions.inputPrefix += path.sep;
        }
      }
    }
    if (config.https) {
      assertString(config.https.keyPath, `"https.keyPath" is required in duck.config`);
      assertString(config.https.certPath, `"https.certPath" is required in duck.config`);
      toAbsPath(config.https, configDir, "keyPath");
      toAbsPath(config.https, configDir, "certPath");
    }
    result = { ...config, ...opts };
  } catch {
    if (opts.config) {
      throw new Error(`duck.config not found: ${opts.config}`);
    }
  }

  if (result.batch === "aws" && !result.concurrency) {
    // 1000 is the max concurrency of AWS Lambda
    result.concurrency = 1000;
  }

  if (result.batch) {
    const { version } = compilerPakageJson;
    if (!semver.satisfies(version, ">=20180716")) {
      throw new Error(
        `Installed google-closure-compiler@${version} is too old for batch mode. Use v20180716 or later.`
      );
    }
  }

  return result;
}

function toAbsPath<T>(config: T, baseDir: string, key: PickKeysByValue<Required<T>, string>) {
  const value = config[key];
  if (typeof value === "string") {
    // "as any": TypeScript can not handle conditional type
    config[key] = path.resolve(baseDir, value) as any;
  }
}

function toAbsPathArray<T>(
  config: T,
  baseDir: string,
  key: PickKeysByValue<Required<T>, string[] | readonly string[]>
) {
  const values = config[key];
  if (Array.isArray(values)) {
    // "as any": TypeScript can not handle conditional type
    config[key] = values.map(value => path.resolve(baseDir, value)) as any;
  }
}
/**
 * @example
 * type Props = {name: string; age: number; visible: boolean};
 * // Keys: 'name' | 'age'
 * type Keys = PickKeysByValue<Props, string | number>;
 */
type PickKeysByValue<T, ValueType> = {
  [Key in keyof T]: T[Key] extends ValueType ? Key : never;
}[keyof T];
