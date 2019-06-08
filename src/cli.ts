import streamToObservable from '@teppeis/stream-to-observable';
import Listr from 'listr';
import path from 'path';
import pino from 'pino';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import split from 'split2';
import yargs from 'yargs';
import {assertNodeVersionGte, assertNonNullable, assertString} from './assert';
import {buildDeps} from './commands/buildDeps';
import {buildJs, BuildJsCompilationError} from './commands/buildJs';
import {buildSoy, BuildSoyConfig} from './commands/buildSoy';
import {cleanDeps} from './commands/cleanDeps';
import {cleanSoy, CleanSoyConfig} from './commands/cleanSoy';
import {serve} from './commands/serve';
import {loadConfig} from './duckconfig';
import {setGlobalLogger} from './logger';

assertNodeVersionGte(process.version, 10);

/**
 * Transform ndjson (Newline Delimited JSON) stream to JSON object stream.
 */
const logStream = split(JSON.parse);
const logger = pino(logStream);
setGlobalLogger(logger);

/**
 * Task wrapper that conbines the log stream with the promise to make an
 * observable that does not "complete" until the promise is resolved,
 * because listr can accept only one of Promise, Stream and Observable.
 */
function wrap(task: () => Promise<any>): () => Observable<string> {
  return () => {
    // Run the task in the next tick to register the observable to listr before the first logging.
    const await = Promise.resolve().then(task);
    return streamToObservable(logStream, {await, endEvent: false}).pipe(
      map<any, string>(obj => {
        if (obj.msg) {
          return String(obj.msg);
        } else {
          return String(obj);
        }
      })
    );
  };
}

export const resultInfoLogType = 'resultInfo';
const resultInfos: ResultInfo[] = [];
logStream.on('data', (data: any) => {
  if (data.type === resultInfoLogType) {
    resultInfos.push({
      title: assertString(data.title),
      bodyString: data.bodyString,
      bodyObject: data.bodyObject,
    });
  }
});

interface ResultInfo {
  title: string;
  bodyString?: string;
  bodyObject?: any;
}

const closureLibraryDir = {
  desc: 'Closure Library directory',
  type: 'string',
  coerce: path.resolve,
} as const;

const config = {
  desc: 'A path to duck.config.js, the extension can be ommited',
  type: 'string',
  coerce: path.resolve,
} as const;

const entryConfigDir = {
  type: 'string',
  // only for typing, the value is loaded from args
  hidden: true,
  coerce: path.resolve,
} as const;

const printConfig = {
  desc: 'Print effective configs for compilers',
  alias: 'p',
  type: 'boolean',
  default: false,
} as const;

const depsJs = {
  desc: 'A path to deps.js to save and load',
  type: 'string',
  coerce: path.resolve,
} as const;

const skipDepsJs = {
  desc: 'Skip generating deps.js',
  type: 'boolean',
  default: false,
} as const;

const buildJsOptions = {
  entryConfigDir,
  entryConfigs: {
    desc: 'Entry config files (this option ignores entryConfigDir)',
    alias: 'e',
    type: 'array',
    coerce: (arr: any[]) => arr.map(item => path.resolve(String(item))),
  },
  closureLibraryDir,
  config,
  concurrency: {
    desc: 'Concurrency limit for compiler',
    alias: 'c',
    type: 'number',
  },
  batch: {
    desc: 'Build in batch mode (on AWS or local for debug)',
    choices: ['aws', 'local'],
  },
  printConfig,
  depsJs,
} as const;

const buildSoyOptions = {
  soyJarPath: {
    desc: 'A path to Soy.jar',
    type: 'string',
    coerce: path.resolve,
  },
  soyFileRoots: {
    desc: 'Root directories of soy files',
    type: 'array',
    coerce: path.resolve,
  },
  config,
  watch: {
    desc: 'Re-compile incrementally when files change',
    alias: 'w',
    type: 'boolean',
    default: false,
  },
  printConfig,
} as const;

const buildDepsOptions = {
  depsJs,
  config,
} as const;

export function run(processArgv: readonly string[]): void {
  yargs
    .command(
      'serve [entryConfigDir]',
      'Start dev server',
      {
        entryConfigDir,
        inputsRoot: {
          desc: 'A root directory to serve',
          type: 'string',
          coerce: path.resolve,
        },
        closureLibraryDir,
        depsJs,
        skipInitialBuild: {
          desc: "Don't build Soy and deps.js before serving",
          alias: 's',
          type: 'boolean',
          default: false,
        },
        port: {
          desc: 'A port number to listen',
          type: 'number',
          default: 9810,
        },
        host: {
          desc: 'A host to listen',
          type: 'string',
          default: 'localhost',
        },
        config,
      },
      async argv => {
        const config = loadConfig(argv);
        const hasSoyConfig: boolean = Boolean(
          config.soyJarPath && config.soyFileRoots && config.soyOptions
        );
        const tasks = new Listr([
          {
            title: `Compile Soy templates`,
            skip: () => !hasSoyConfig || argv.skipInitialBuild,
            task: wrap(() => buildSoy(config as BuildSoyConfig)),
          },
          {
            title: `Generate deps.js`,
            skip: () => !config.depsJs || argv.skipInitialBuild,
            task: wrap(() => buildDeps(config)),
          },
        ]);
        await tasks.run();
        console.log(''); // a blank line
        await serve(config);
      }
    )
    .command(
      'build [entryConfigDir]',
      'Build Soy, deps.js and JS',
      {
        ...buildJsOptions,
        skipDepsJs,
        ...buildSoyOptions,
      },
      async argv => {
        const config = loadConfig(argv);
        const tasks = new Listr([
          {
            title: `Compile Soy templates`,
            skip: () => !(config.soyJarPath && config.soyFileRoots && config.soyOptions),
            task: wrap(() => buildSoy(config as BuildSoyConfig, argv.printConfig)),
          },
          {
            title: `Generate deps.js`,
            skip: () => !config.depsJs || argv.skipDepsJs,
            task: wrap(() => buildDeps(config)),
          },
          {
            title: `Compile JS files`,
            task: wrap(() => buildJs(config, argv.entryConfigs as string[], argv.printConfig)),
          },
        ]);
        await tasks.run().catch(printOnlyCompilationError);
        printResultInfo();
      }
    )
    .command('build:js [entryConfigDir]', 'Compile JS files', buildJsOptions, async argv => {
      const config = loadConfig(argv);
      const tasks = new Listr([
        {
          title: `Compile JS files`,
          task: wrap(() => buildJs(config, argv.entryConfigs as string[], argv.printConfig)),
        },
      ]);
      await tasks.run().catch(printOnlyCompilationError);
      printResultInfo();
    })
    .command('build:soy', 'Compile Soy templates', buildSoyOptions, async argv => {
      const config = loadConfig(argv);
      assertString(config.soyJarPath);
      assertNonNullable(config.soyFileRoots);
      assertNonNullable(config.soyOptions);
      const tasks = new Listr([
        {
          title: `Compile Soy templates`,
          task: wrap(() => buildSoy(config as BuildSoyConfig, argv.printConfig)),
        },
      ]);
      await tasks.run();
      printResultInfo();
    })
    .command('build:deps', 'Generate deps.js', buildDepsOptions, async argv => {
      const config = loadConfig(argv);
      const tasks = new Listr([
        {
          title: `Generate deps.js`,
          task: wrap(() => buildDeps(config)),
        },
      ]);
      await tasks.run();
      printResultInfo();
    })
    .command('clean:soy', 'Remove all compiled .soy.js', buildSoyOptions, async argv => {
      const config = loadConfig(argv);
      assertNonNullable(config.soyOptions);
      const tasks = new Listr([
        {
          title: `Clean up soy.js`,
          task: wrap(() => cleanSoy(config as CleanSoyConfig)),
        },
      ]);
      await tasks.run();
    })
    .command('clean:deps', 'Remove generated deps.js', buildDepsOptions, async argv => {
      const config = loadConfig(argv);
      const tasks = new Listr([
        {
          title: `Clean up deps.js: ${config.depsJs}`,
          task: wrap(() => cleanDeps(assertString(config.depsJs))),
        },
      ]);
      await tasks.run();
    })
    .completion('completion', 'Generate completion script for bash/zsh')
    .demandCommand(1, 1)
    .scriptName('duck')
    .locale('en')
    .epilog('CLI options overwrite config file')
    // default 80 is too short for command usage lines
    .wrap(98)
    .strict()
    .help()
    .showHelpOnFail(false, 'Specify --help or -h for available options')
    .alias('v', 'version')
    .alias('h', 'help')
    .parse(processArgv);
}

function printOnlyCompilationError(e: any): Promise<void> {
  if (e instanceof BuildJsCompilationError) {
    // Print compile errors
    console.error(`\n# ${e.message}\n\n${e.reasons.map(m => `## ${m}`).join('\n')}`);
    process.exit(1);
  }
  return Promise.reject(e);
}

function printResultInfo() {
  if (resultInfos.length > 0) {
    resultInfos.forEach(info => {
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
