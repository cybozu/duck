import path from 'path';
import yargs from 'yargs';
import {assertNodeVersionGte} from './assert';
import {buildJs} from './commands/buildJs';
import {buildSoy} from './commands/buildSoy';
import {cleanSoy} from './commands/cleanSoy';
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
  alias: 'c',
  type: 'string',
  coerce: path.resolve,
} as const;

const entryConfigDir = {
  type: 'string',
  // only for typing, the value is loaded from args
  hidden: true,
  coerce: path.resolve,
} as const;

const buildJsOptions = {
  entryConfigDir,
  closureLibraryDir,
  config,
  printConfig: {
    desc: 'Print effective config for Closure Compiler',
    type: 'boolean',
    default: false,
  },
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
  printConfig: {
    desc: 'Print effective config for SoyToJs compiler',
    type: 'boolean',
    default: false,
  },
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
        port: {
          desc: 'A port number to listen',
          alias: 'p',
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
      argv => {
        const config = loadConfig(argv);
        console.log('Starging dev server...');
        serve(config);
      }
    )
    .command(
      'build [entryConfigDir|entryConfig..]',
      'Compile Soy and JS files',
      {
        ...buildJsOptions,
        ...buildSoyOptoins,
        skipSoy: {
          desc: 'Skip compiling Soy files before compiling JS',
          type: 'boolean',
          default: false,
        },
        printConfig: {
          desc: 'Print effective configs for compilers',
          type: 'boolean',
          default: false,
        },
      },
      async argv => {
        const config = loadConfig(argv);
        if (!argv.skipSoy) {
          console.log('Compiling Soy...');
          await buildSoy(config, argv.printConfig);
        }
        try {
          console.log('Compiling JS...');
          await buildJs(config, argv.printConfig);
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
    .command(
      'build:js [entryConfigDir|entryConfig..]',
      'Compile JS files',
      buildJsOptions,
      async argv => {
        const config = loadConfig(argv);
        try {
          console.log('Compiling JS...');
          await buildJs(config, argv.printConfig);
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
    .command('build:soy', 'Compile Soy templates', buildSoyOptoins, async argv => {
      const config = loadConfig(argv);
      console.log('Compiling Soy...');
      await buildSoy(config, argv.printConfig);
    })
    .command('clean:soy', 'Remove all compiled .soy.js', buildSoyOptoins, async argv => {
      const config = loadConfig(argv);
      console.log('Cleaning up soy.js...');
      await cleanSoy(config);
    })
    .demandCommand(1, 1)
    .scriptName('duck')
    .epilog('CLI options overwrite config file')
    // default 80 is too short for command usage lines
    .wrap(90)
    .strict()
    .help()
    .parse(processArgv);
}
