import type { AwsOptions, LocalOptions } from "faastjs";
import path from "path";
import { assertString } from "./assert.js";
import { toAbsPath, toAbsPathArray } from "./pathutils.js";
import type { JsonReporterOptions } from "./reporters/json-reporter.js";
import type { TextReporterOptions } from "./reporters/text-reporter.js";
import type { XUnitReporterOptions } from "./reporters/xunit-reporter.js";
import type { SoyToJsOptions } from "./soy.js";
import { normalizeSoyOptoins } from "./soy.js";

export interface DuckConfig {
  /**
   * (Required) A path to Closure Library direcotry
   * @example "node_modules/google-closure-library"
   */
  closureLibraryDir: string;
  /**
   * (Required) A directory where entry config JSONs are stored flat
   */
  entryConfigDir: string;
  /**
   * (Required) A root directory scanned to build deps.js and delivered as static assets
   */
  inputsRoot: string;
  /**
   * A path to deps.js to save and load in build and serve commands
   * @example "dist/deps.js"
   */
  depsJs?: string;
  /**
   * Directories ignored when building deps.js
   */
  depsJsIgnoreDirs: readonly string[];
  /**
   * The number of worker threads to build deps.js (default: 4)
   */
  depsWorkers?: number;
  /**
   * Directories where .soy files are stored. Required if use soy.
   */
  soyFileRoots: readonly string[];
  /**
   * Send srcs to closure-templates as relative paths from this.
   * Also change cwd to this and run closure-templates. (default: undefined)
   */
  soySrcsRelativeFrom?: string;
  /**
   * A path to Closure Templates JAR. Required if use soy.
   */
  soyJarPath?: string;
  /**
   * Classpaths for Closure Templates plugins
   * @example ["lib/plugin.jar"]
   */
  soyClasspaths: readonly string[];
  /**
   * Options for Closure Templates CLI
   */
  soyOptions: SoyToJsOptions;
  /**
   * Concurrency of Closure Compiler (default: 1,000 if AWS batch mode, otherwise 1)
   */
  concurrency?: number;
  /**
   * Build in batch mode with faast.js on "aws" for production or "local" for debug (default: undefined)
   */
  batch?: "aws" | "local";
  /**
   * Custom Closure Compiler package used in AWS batch mode (default: undefined)
   * It must be published as a public npm pacakge.
   * @example {name: "my-custom-closure-compiler", version: "^1.0.0"}
   */
  batchAwsCustomCompiler?: {
    name: string;
    version: string;
  };
  /**
   * Max chunk size in bytes for spliting return value from faastjs module.
   * The upper limit is 256kb. (default: 204,800 (200kb))
   */
  batchMaxChunkSize?: number;
  /**
   * Options for faast.js in batch mode.
   * @see https://faastjs.org/docs/api/faastjs.awsoptions
   */
  batchOptions?: AwsOptions | LocalOptions;
  /**
   * Reporters (choose from "json", "text" or "xunit")
   */
  reporters?: Array<"json" | "text" | "xunit">;
  /**
   * Options for each test reporter
   */
  reporterOptions?: {
    json?: JsonReporterOptions;
    text?: TextReporterOptions;
    xunit?: XUnitReporterOptions;
  };
  /**
   * Hostname for serve command (default: 0.0.0.0)
   */
  host: string;
  /**
   * Port number for serve command (default: 9810)
   */
  port: number;
  /**
   * Use HTTP/2 in serve command (deafult: false)
   */
  http2?: boolean;
  /**
   * Settings for HTTPS (HTTP/2) (default: not specified, HTTP is used)
   */
  https?: {
    /**
     * A path to a private key
     */
    keyPath: string;
    /**
     * A path to a self-signed certificate
     */
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
    const config: DuckConfig = require(configPath);
    const configDir = path.dirname(configPath);
    // resolve relative path to absolute
    toAbsPath(config, configDir, "closureLibraryDir");
    toAbsPath(config, configDir, "inputsRoot");
    toAbsPath(config, configDir, "entryConfigDir");
    toAbsPath(config, configDir, "soyJarPath");
    toAbsPath(config, configDir, "soySrcsRelativeFrom");
    toAbsPath(config, configDir, "depsJs");
    toAbsPathArray(config, configDir, "depsJsIgnoreDirs");
    toAbsPathArray(config, configDir, "soyClasspaths");
    toAbsPathArray(config, configDir, "soyFileRoots");
    normalizeSoyOptoins(config, configDir);
    if (config.https) {
      assertString(
        config.https.keyPath,
        `"https.keyPath" is required in duck.config`
      );
      assertString(
        config.https.certPath,
        `"https.certPath" is required in duck.config`
      );
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

  if (result.batchAwsCustomCompiler) {
    if (!result.batchAwsCustomCompiler.name) {
      throw new TypeError(
        "batchAwsCustomCompiler.name is required in duck.config"
      );
    }
    if (!result.batchAwsCustomCompiler.version) {
      throw new TypeError(
        "batchAwsCustomCompiler.version is required in duck.config"
      );
    }
  }
  return result;
}
