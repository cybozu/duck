import path from 'path';
import yargs from 'yargs';
import {assertNodeVersionGte, assertNonNullable, assertString} from './assert';
import {buildJs} from './commands/buildJs';
import {buildSoy, BuildSoyConfig, watchSoy} from './commands/buildSoy';
import {cleanSoy, CleanSoyConfig} from './commands/cleanSoy';
import {serve} from './commands/serve';
import {loadConfig} from './duckconfig';

assertNodeVersionGte(process.version, 10);

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
  printConfig,
} as const;

const buildSoyOptoins = {
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

export function run(processArgv: string[]): void {
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
        if (config.soyJarPath && config.soyFileRoots && config.soyOptions) {
          if (!argv.skipInitialSoy) {
            console.log('Compiling Soy templates...');
            await buildSoy(config as BuildSoyConfig);
          }
          watchSoy(config as BuildSoyConfig);
        } else {
          console.log('Skip compiling Soy templates. (missing config)');
        }
        console.log('Starging dev server...');
        serve(config);
      }
    )
    .command(
      'build [entryConfigDir]',
      'Compile Soy and JS files',
      {
        ...buildJsOptions,
        ...buildSoyOptoins,
        watch: {
          desc: '--watch is not supported in build command',
          hidden: true,
        },
      },
      async argv => {
        const config = loadConfig(argv);
        if (config.soyJarPath && config.soyFileRoots && config.soyOptions) {
          console.log('Compiling Soy templates...');
          const templates = await buildSoy(config as BuildSoyConfig, argv.printConfig);
          console.log(`${templates.length} templates compiled!`);
        } else {
          console.log('Skip compiling Soy templates. (missing config)');
        }
        try {
          console.log('Compiling JS files...');
          await buildJs(config, argv.entryConfigs as string[], argv.printConfig);
          console.log('JS compiled!');
        } catch (e) {
          if (e instanceof Error) {
            console.error(e.message);
          } else {
            console.error(e);
          }
          process.exit(1);
        }
      }
    )
    .command('build:js [entryConfigDir]', 'Compile JS files', buildJsOptions, async argv => {
      const config = loadConfig(argv);
      try {
        console.log('Compiling JS files...');
        await buildJs(config, argv.entryConfigs as string[], argv.printConfig);
        console.log('JS compiled!');
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.message);
        } else {
          console.error(e);
        }
        process.exit(1);
      }
    })
    .command('build:soy', 'Compile Soy templates', buildSoyOptoins, async argv => {
      const config = loadConfig(argv);
      console.log('Compiling Soy templates...');
      assertString(config.soyJarPath);
      assertNonNullable(config.soyFileRoots);
      assertNonNullable(config.soyOptions);
      const templates = await buildSoy(config as BuildSoyConfig, argv.printConfig);
      console.log(`${templates.length} templates compiled!`);
    })
    .command('clean:soy', 'Remove all compiled .soy.js', buildSoyOptoins, async argv => {
      const config = loadConfig(argv);
      console.log('Cleaning up soy.js...');
      assertNonNullable(config.soyOptions);
      await cleanSoy(config as CleanSoyConfig);
    })
    .demandCommand(1, 1)
    .scriptName('duck')
    .epilog('CLI options overwrite config file')
    // default 80 is too short for command usage lines
    .wrap(90)
    .strict()
    .help()
    .alias('v', 'version')
    .alias('h', 'help')
    .parse(processArgv);
}
