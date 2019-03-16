import yargs from 'yargs';
import {serve} from './serve';

export function run(processArgv: string[]): void {
  yargs
    .command(
      'serve [entryConfigDir]',
      'Start dev server',
      {
        port: {
          desc: 'A port number to listen',
          alias: 'p',
          type: 'number',
          default: 9810,
        },
        entryConfigDir: {
          type: 'string',
          // only for typing, the value is loaded from args
          hidden: true,
        },
      },
      argv => {
        serve(argv);
      }
    )
    .command(
      'build [entryConfigDir|entryConfig]',
      'Compile the inputs',
      {
        printConfig: {
          desc: 'Print all config of the compiler to stderr',
          type: 'boolean',
          default: false,
        },
        entryConfigDir: {
          type: 'string',
          // only for typing, the value is loaded from args
          hidden: true,
        },
        entryConfig: {
          type: 'string',
          // only for typing, the value is loaded from args
          hidden: true,
        },
      },
      argv => {
        // TODO: not yet implemented
        console.log(argv);
      }
    )
    .demandCommand(1, 1)
    .scriptName('duck')
    // default 80 is too short for command usage lines
    .wrap(90)
    .strict()
    .help()
    .parse(processArgv);
}
