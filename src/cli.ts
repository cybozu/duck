import streamToObservable from "@teppeis/stream-to-observable";
import Listr from "listr";
import os from "os";
import path from "path";
import { pino } from "pino";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators/index.js";
import split from "split2";
import yargs from "yargs";
import { assertNonNullable, assertString } from "./assert.js";
import { buildDeps } from "./commands/buildDeps.js";
import { BuildJsCompilationError, buildJs } from "./commands/buildJs.js";
import type { BuildSoyConfig } from "./commands/buildSoy.js";
import { buildSoy } from "./commands/buildSoy.js";
import { cleanDeps } from "./commands/cleanDeps.js";
import type { CleanSoyConfig } from "./commands/cleanSoy.js";
import { cleanSoy } from "./commands/cleanSoy.js";
import { serve } from "./commands/serve.js";
import type { DuckConfig } from "./duckconfig.js";
import { loadConfig } from "./duckconfig.js";
import { setGlobalLogger } from "./logger.js";
import type { ErrorReason } from "./report.js";
import { reportTestResults } from "./report.js";

/**
 * Transform ndjson (Newline Delimited JSON) stream to JSON object stream.
 */
const logStream = split(JSON.parse);
const logger = pino({ level: process.env.DEBUG ? "debug" : "info" }, logStream);
setGlobalLogger(logger);

/**
 * Task wrapper that conbines the log stream with the promise to make an
 * observable that does not "complete" until the promise is resolved,
 * because listr can accept only one of Promise, Stream and Observable.
 */
function wrap(task: () => Promise<any>): () => Observable<string> {
  return () => {
    // Run the task in the next tick to register the observable to listr before the first logging.
    const doingTask = Promise.resolve().then(task);
    return streamToObservable(logStream, {
      await: doingTask,
      endEvent: false,
    }).pipe(
      map<any, string>((obj) => {
        if (obj.msg) {
          return String(obj.msg);
        }
        return String(obj);
      }),
    );
  };
}

export const resultInfoLogType = "resultInfo";
const resultInfos: ResultInfo[] = [];
logStream.on("data", (data: any) => {
  if (data.type === resultInfoLogType) {
    resultInfos.push({
      title: assertString(data.title),
      bodyString: data.bodyString,
      bodyObject: data.bodyObject,
    });
  }
});

function assertStringWithConfig(config: DuckConfig, key: keyof DuckConfig) {
  const value = config[key];
  return assertString(value, `'${key}' is not string(${value}).`);
}
function assertNonNullableWithConfig(
  config: DuckConfig,
  key: keyof DuckConfig,
) {
  const value = config[key];
  return assertNonNullable(value, `'${key}' is ${value}.`);
}

interface ResultInfo {
  title: string;
  bodyString?: string;
  bodyObject?: any;
}

const nonTTY = {
  desc: "Output in nonTTY mode",
  type: "boolean",
  alias: ["noTTY", "n"],
  default: false,
} as const;

const closureLibraryDir = {
  desc: "A root directory of Closure Library",
  type: "string",
  coerce: path.resolve,
} as const;

const config = {
  desc: "A path to duck.config.js, the extension can be ommited",
  type: "string",
  coerce: path.resolve,
} as const;

const entryConfigDir = {
  type: "string",
  // only for typing, the value is loaded from args
  hidden: true,
  coerce: path.resolve,
} as const;

const printConfig = {
  desc: "Print effective configs for compilers",
  alias: "p",
  type: "boolean",
  default: false,
} as const;

const depsJs = {
  desc: "A path to deps.js to save and load",
  type: "string",
  coerce: path.resolve,
} as const;

const skipInitialBuild = {
  desc: "Skip initial building of Soy and deps.js",
  alias: "s",
  type: "boolean",
  default: false,
} as const;

const buildJsOptions = {
  entryConfigDir,
  entryConfigs: {
    desc: "Entry config files (this option ignores entryConfigDir)",
    alias: "e",
    type: "array",
    coerce: (arr: any[]) => arr.map((item) => path.resolve(String(item))),
  },
  closureLibraryDir,
  config,
  concurrency: {
    desc: "Concurrency limit of Closure Compiler",
    alias: "c",
    type: "number",
  },
  batch: {
    desc: "Build in batch mode (on AWS or local for debug)",
    choices: ["aws", "local"],
  },
  reporters: {
    desc: 'Test reporters ("text", "xunit" or "json")',
    type: "array",
    default: ["text"],
  },
  reporterOptions: {
    desc: "Test reporter options",
  },
  printConfig,
  depsJs,
  nonTTY,
} as const;

const buildSoyOptions = {
  soyJarPath: {
    desc: "A path to Soy.jar",
    type: "string",
    coerce: path.resolve,
  },
  soyFileRoots: {
    desc: "Root directories of soy files",
    type: "array",
    coerce: path.resolve,
  },
  soyClasspaths: {
    desc: "Classpaths for running Soy.jar",
    type: "array",
    coerce: path.resolve,
  },
  config,
  watch: {
    desc: "Re-compile incrementally when files change",
    alias: "w",
    type: "boolean",
    default: false,
  },
  printConfig,
  nonTTY,
} as const;

const buildDepsOptions = {
  depsJs,
  depsWorkers: {
    desc: "The number of workers to analyze deps",
    type: "number",
    default: Math.min(4, Math.max(os.cpus().length, 1)),
  },
  config,
  nonTTY,
} as const;

export function run(processArgv: readonly string[]): void {
  yargs(processArgv)
    .command(
      "serve [entryConfigDir]",
      "Start dev server",
      {
        entryConfigDir,
        inputsRoot: {
          desc: "A root directory to serve",
          type: "string",
          coerce: path.resolve,
        },
        closureLibraryDir,
        ...buildDepsOptions,
        skipInitialBuild,
        port: {
          desc: "A port number to listen",
          type: "number",
          default: 9810,
        },
        host: {
          desc: "A host to listen",
          type: "string",
          default: "0.0.0.0",
        },
        config,
        nonTTY,
      },
      async (argv) => {
        const conf = loadConfig(argv);
        const hasSoyConfig = Boolean(
          conf.soyJarPath && conf.soyFileRoots.length > 0 && conf.soyOptions,
        );
        const tasks = listr(
          [
            {
              title: `Compile Soy templates`,
              skip: () => !hasSoyConfig || argv.skipInitialBuild,
              task: wrap(() => buildSoy(conf as BuildSoyConfig)),
            },
            {
              title: `Generate deps.js`,
              skip: () => !conf.depsJs || argv.skipInitialBuild,
              task: wrap(() => buildDeps(conf)),
            },
          ],
          argv,
        );
        await tasks.run();
        console.log(""); // a blank line
        await serve(conf);
      },
    )
    .command(
      "build [entryConfigDir]",
      "Build Soy, deps.js and JS",
      {
        ...buildJsOptions,
        ...buildDepsOptions,
        skipInitialBuild,
        ...buildSoyOptions,
        nonTTY,
      },
      async (argv) => {
        const conf = loadConfig(argv);
        let warnings: ErrorReason[] = [];
        const tasks = listr(
          [
            {
              title: `Compile Soy templates`,
              skip: () =>
                argv.skipInitialBuild ||
                !(
                  conf.soyJarPath &&
                  conf.soyFileRoots.length > 0 &&
                  conf.soyOptions
                ),
              task: wrap(() =>
                buildSoy(conf as BuildSoyConfig, argv.printConfig),
              ),
            },
            {
              title: `Generate deps.js`,
              skip: () => !conf.depsJs || argv.skipInitialBuild,
              task: wrap(() => buildDeps(conf)),
            },
            {
              title: `Compile JS files`,
              task: wrap(async () => {
                warnings = await buildJs(
                  conf,
                  argv.entryConfigs as string[],
                  argv.printConfig,
                );
              }),
            },
          ],
          argv,
        );
        await tasks.run().catch(printOnlyCompilationError(conf));
        printResultInfo();
        if (warnings.length > 0 && !argv.printConfig) {
          reportTestResults(warnings, conf);
        }
      },
    )
    .command(
      "build:js [entryConfigDir]",
      "Compile JS files",
      buildJsOptions,
      async (argv) => {
        const conf = loadConfig(argv);
        let warnings: ErrorReason[] = [];
        const tasks = listr(
          [
            {
              title: `Compile JS files`,
              task: wrap(async () => {
                warnings = await buildJs(
                  conf,
                  argv.entryConfigs as string[],
                  argv.printConfig,
                );
              }),
            },
          ],
          argv,
        );
        await tasks.run().catch(printOnlyCompilationError(conf));
        printResultInfo();
        if (warnings.length > 0 && !argv.printConfig) {
          reportTestResults(warnings, conf);
        }
      },
    )
    .command(
      "build:soy",
      "Compile Soy templates",
      buildSoyOptions,
      async (argv) => {
        const conf = loadConfig(argv);
        assertStringWithConfig(conf, "soyJarPath");
        assertNonNullableWithConfig(conf, "soyFileRoots");
        assertNonNullableWithConfig(conf, "soyOptions");
        const tasks = listr(
          [
            {
              title: `Compile Soy templates`,
              task: wrap(() =>
                buildSoy(conf as BuildSoyConfig, argv.printConfig),
              ),
            },
          ],
          argv,
        );
        await tasks.run();
        printResultInfo();
      },
    )
    .command(
      "build:deps",
      "Generate deps.js",
      buildDepsOptions,
      async (argv) => {
        const conf = loadConfig(argv);
        const tasks = listr(
          [
            {
              title: `Generate deps.js`,
              task: wrap(() => buildDeps(conf)),
            },
          ],
          argv,
        );
        await tasks.run();
        printResultInfo();
      },
    )
    .command(
      "clean:soy",
      "Remove all compiled .soy.js",
      buildSoyOptions,
      async (argv) => {
        const conf = loadConfig(argv);
        assertNonNullableWithConfig(conf, "soyOptions");
        const tasks = listr(
          [
            {
              title: `Clean up soy.js`,
              task: wrap(() => cleanSoy(conf as CleanSoyConfig)),
            },
          ],
          argv,
        );
        await tasks.run();
      },
    )
    .command(
      "clean:deps",
      "Remove generated deps.js",
      buildDepsOptions,
      async (argv) => {
        const conf = loadConfig(argv);
        const tasks = listr(
          [
            {
              title: `Clean up deps.js: ${conf.depsJs}`,
              task: wrap(() =>
                cleanDeps(assertStringWithConfig(conf, "depsJs")),
              ),
            },
          ],
          argv,
        );
        await tasks.run();
      },
    )
    .completion("completion", "Generate completion script for bash/zsh")
    .demandCommand(1, 1)
    .scriptName("duck")
    .locale("en")
    .epilog("CLI options overwrite config file")
    // default 80 is too short for command usage lines
    .wrap(98)
    .strict()
    .help()
    .showHelpOnFail(false, "Specify --help or -h for available options")
    .alias("v", "version")
    .alias("h", "help")
    .parse();
}

function listr<T>(
  tasks: ReadonlyArray<Listr.ListrTask<T>>,
  argv: { nonTTY: boolean },
  options: Listr.ListrOptions<T> = {},
): Listr<T> {
  return new Listr<T>(tasks, {
    ...options,
    renderer: argv.nonTTY ? "verbose" : "default",
  });
}

function printOnlyCompilationError(conf: DuckConfig) {
  return async (e: any) => {
    if (e instanceof BuildJsCompilationError) {
      await reportTestResults(e.reasons, conf);
      console.log("");
      return Promise.reject();
    }
    return Promise.reject(e);
  };
}

function printResultInfo() {
  if (resultInfos.length > 0) {
    resultInfos.forEach((info) => {
      console.log(`\n${info.title}:`);
      if (info.bodyString) {
        console.log(info.bodyString);
      }
      if (info.bodyObject) {
        console.dir(info.bodyObject);
      }
    });
  }
}
