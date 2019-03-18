import path from 'path';
import yargs from 'yargs';
import {build} from './build';
import {loadConfig} from './duckconfig';
import {serve} from './serve';

export function run(processArgv: string[]): void {
  yargs
    .command(
      'serve [entryConfigDir]',
      'Start dev server',
      {
        entryConfigDir: {
          type: 'string',
          // only for typing, the value is loaded from args
          hidden: true,
          coerce: path.resolve,
        },
        inputsRoot: {
          desc: 'A root directory to serve',
          type: 'string',
          coerce: path.resolve,
        },
        closureLibraryDir: {
          desc: 'Closure Library directory',
          type: 'string',
          coerce: path.resolve,
        },
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
        config: {
          desc: 'A path to duck.config.js, the extension can be ommited',
          alias: 'c',
          type: 'string',
          coerce: path.resolve,
        },
      },
      argv => {
        const config = loadConfig(argv);
        serve(config);
      }
    )
    .command(
      'build [entryConfigDir|entryConfig]',
      'Compile the inputs',
      {
        entryConfigDir: {
          type: 'string',
          // only for typing, the value is loaded from args
          hidden: true,
          coerce: path.resolve,
        },
        closureLibraryDir: {
          desc: 'Closure Library directory',
          type: 'string',
          coerce: path.resolve,
        },
        config: {
          desc: 'A path to duck.config.js, the extension can be ommited',
          alias: 'c',
          type: 'string',
          coerce: path.resolve,
        },
        printConfig: {
          desc: 'Print all config of the compiler to stderr',
          type: 'boolean',
          default: false,
        },
      },
      async argv => {
        const config = loadConfig(argv);
        try {
          await build(config);
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
    .demandCommand(1, 1)
    .scriptName('duck')
    .epilog('CLI options overwrite config file')
    // default 80 is too short for command usage lines
    .wrap(90)
    .strict()
    .help()
    .parse(processArgv);
}
