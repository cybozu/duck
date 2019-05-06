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
 * Conbine log stream with a promise to make an observable that does not "complete" until the promise is resolved,
 * Because listr can accept only one of Promise, Stream and Observable.
 */
function toObservable(p: Promise<any>): Observable<string> {
  return streamToObservable(logStream, {await: p, endEvent: false}).pipe(
    map<any, string>(obj => {
      if (obj.msg) {
        return String(obj.msg);
      } else {
        return String(obj);
      }
    })
  );
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

const watch = {
  desc: 'Re-compile incrementally when files change',
  alias: 'w',
  type: 'boolean',
  default: false,
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
    default: 1,
  },
  depsJs,
  printConfig,
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
  watch,
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
        skipInitialSoy: {
          desc: 'Skip initial compiling of Soy templates',
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
            skip: () => !hasSoyConfig || argv.skipInitialSoy,
            task: () => toObservable(buildSoy(config as BuildSoyConfig)),
          },
        ]);
        await tasks.run();
        console.log(''); // a blank line
        serve(config);
      }
    )
    .command(
      'build [entryConfigDir]',
      'Compile Soy and JS files',
      {
        ...buildJsOptions,
        ...buildSoyOptions,
        watch: {
          desc: '--watch is not supported in build command',
          hidden: true,
        },
      },
      async argv => {
        const config = loadConfig(argv);
        const hasSoyConfig: boolean = Boolean(
          config.soyJarPath && config.soyFileRoots && config.soyOptions
        );
        const {printConfig} = argv;
        const tasks = new Listr([
          {
            title: `Compile Soy templates`,
            skip: () => !hasSoyConfig,
            task: () => toObservable(buildSoy(config as BuildSoyConfig, printConfig)),
          },
          {
            title: `Compile JS files`,
            task: () => toObservable(buildJs(config, argv.entryConfigs as string[], printConfig)),
          },
        ]);
        await tasks.run().catch(printOnlyCompilationError);
        printResultInfo();
      }
    )
    .command('build:js [entryConfigDir]', 'Compile JS files', buildJsOptions, async argv => {
      const config = loadConfig(argv);
      const {printConfig} = argv;
      const tasks = new Listr([
        {
          title: `Compile JS files`,
          task: () => toObservable(buildJs(config, argv.entryConfigs as string[], printConfig)),
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
      const {printConfig} = argv;
      const tasks = new Listr([
        {
          title: `Compile Soy templates`,
          task: () => toObservable(buildSoy(config as BuildSoyConfig, printConfig)),
        },
      ]);
      await tasks.run();
      printResultInfo();
    })
    .command('build:deps', 'Generate deps.js', buildDepsOptions, async argv => {
      const config = loadConfig(argv);
      const tasks = new Listr(
        [
          {
            title: `Generate deps.js`,
            task: () => toObservable(buildDeps(config)),
          },
        ],
        {renderer: 'default', collapse: false, clearOutput: true} as any
      );
      await tasks.run();
      printResultInfo();
    })
    .command('clean:soy', 'Remove all compiled .soy.js', buildSoyOptions, async argv => {
      const config = loadConfig(argv);
      assertNonNullable(config.soyOptions);
      const tasks = new Listr([
        {
          title: `Clean up soy.js`,
          task: () => toObservable(cleanSoy(config as CleanSoyConfig)),
        },
      ]);
      await tasks.run();
    })
    .command('clean:deps', 'Remove generated deps.js', buildDepsOptions, async argv => {
      const config = loadConfig(argv);
      const tasks = new Listr([
        {
          title: `Clean up deps.js: ${config.depsJs}`,
          task: () => toObservable(cleanDeps(assertString(config.depsJs))),
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
    .wrap(90)
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
