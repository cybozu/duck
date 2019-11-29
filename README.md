# @teppeis/duck

Serves and builds an app with Google Closure Compiler/Library/Templates. An alternative to [plovr](https://github.com/bolinfest/plovr).

Status: **_WIP_**

[![npm][npm-image]][npm-url]
![node.js support versions][node-version]
[![build status][circleci-image]][circleci-url]
[![coverage][codecov-image]][codecov-url]
[![dependency status][deps-image]][deps-url]
[![license][license]](./LICENSE)

<a title="Berkaycagdas [CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0)], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File:Yellow_Duck.jpg"><img width="256" alt="Yellow Duck" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Yellow_Duck.jpg/256px-Yellow_Duck.jpg"></a>

## Install

```console
$ npm i -D @teppeis/duck
```

## Usage

```
duck <command>

Commands:
  duck serve [entryConfigDir]     Start dev server
  duck build [entryConfigDir]     Build Soy, deps.js and JS
  duck build:js [entryConfigDir]  Compile JS files
  duck build:soy                  Compile Soy templates
  duck build:deps                 Generate deps.js
  duck clean:soy                  Remove all compiled .soy.js
  duck clean:deps                 Remove generated deps.js
  duck completion                 Generate completion script for bash/zsh

Options:
  -v, --version  Show version number                                                     [boolean]
  -h, --help     Show help                                                               [boolean]

CLI options overwrite config file
```

### `duck serve`

```
duck serve [entryConfigDir]

Start dev server

Options:
  --inputsRoot            A root directory to serve                                       [string]
  --closureLibraryDir     A root directory of Closure Library                             [string]
  --depsJs                A path to deps.js to save and load                              [string]
  --depsWorkers           The number of workers to analyze deps              [number] [default: 4]
  --config                A path to duck.config.js, the extension can be ommited          [string]
  --nonTTY, --noTTY, -n   Output in nonTTY mode                         [boolean] [default: false]
  --skipInitialBuild, -s  Skip initial building of Soy and deps.js      [boolean] [default: false]
  --port                  A port number to listen                         [number] [default: 9810]
  --host                  A host to listen                         [string] [default: "localhost"]
  -v, --version           Show version number                                            [boolean]
  -h, --help              Show help                                                      [boolean]
```

### `duck build`

```
duck build [entryConfigDir]

Build Soy, deps.js and JS

Options:
  --entryConfigs, -e      Entry config files (this option ignores entryConfigDir)          [array]
  --closureLibraryDir     A root directory of Closure Library                             [string]
  --config                A path to duck.config.js, the extension can be ommited          [string]
  --concurrency, -c       Concurrency limit of Closure Compiler                           [number]
  --batch                 Build in batch mode (on AWS or local for debug)[choices: "aws", "local"]
  --reporters             Test reporters ("text", "xunit" or "json")   [array] [default: ["text"]]
  --reporterOptions       Test reporter options
  --printConfig, -p       Print effective configs for compilers         [boolean] [default: false]
  --depsJs                A path to deps.js to save and load                              [string]
  --nonTTY, --noTTY, -n   Output in nonTTY mode                         [boolean] [default: false]
  --depsWorkers           The number of workers to analyze deps              [number] [default: 4]
  --skipInitialBuild, -s  Skip initial building of Soy and deps.js      [boolean] [default: false]
  --soyJarPath            A path to Soy.jar                                               [string]
  --soyFileRoots          Root directories of soy files                                    [array]
  --watch, -w             Re-compile incrementally when files change    [boolean] [default: false]
  -v, --version           Show version number                                            [boolean]
  -h, --help              Show help                                                      [boolean]
```

## `duck.config.js`

Create a config file `duck.config.js` or `duck.config.json` on your project root.
Set every path as a relative path from the location of `duck.config.js`.

```js
module.exports = {
  /**
   * Common settings
   */
  // (Required) A path to Closure Library direcotry
  closureLibraryDir: "node_modules/google-closure-library",
  // (Required) A directory where entry config JSONs are stored flat
  entryConfigDir: "entry-configs",

  /**
   * Generating and loading deps.js
   */
  // A path to deps.js to save and load in build and serve commands
  depsJs: "build/deps.js",
  // Directories ignored when building deps.js
  depsJsIgnoreDirs: ["src/third_party"],
  // The number of workers to build deps.js. Node v10 uses processes and node v12+ uses threads. (default: 4)
  depsWorkers: 2,

  /**
   * Building Soy
   */
  // (Required) A path to Closure Templates JAR
  soyJarPath: "lib/closure-templates.jar",
  // (Required) Directories where Closure Templates .soy files are stored
  soyFileRoots: ["src/soy"],
  // CLI options for Closure Templates
  soyOptions: {
    shouldGenerateJsdoc: true,
  },

  /**
   * Compiling JavaScript
   */
  // Concurrency of Closure Compiler (default: 1,000 if AWS batch mode, otherwise 1)
  concurrency: 4,
  // Build in batch mode on "aws" for production or "local" for debug (default: disabled)
  batch: "aws",
  // Options for faast.js in batch mode. See https://faastjs.org/docs/api/faastjs.awsoptions
  batchOptions: {},
  // Reporters (choose from "json", "text" or "xunit")
  reporters: ["text", "xunit"],
  // Options for each test reporter
  reporterOptions: {
    text: {
      // Output errors to stderr or not
      stderr: false,
      // A directory where reporters output
      outputDir: "test-results/text",
    },
    xunit: {},
  },

  /**
   * Serve
   */
  // (Required) A root directory scanned to build deps.js and delivered as static assets in serve command
  inputsRoot: "src/inputs",
  // Hostname for serve command (default: 0.0.0.0)
  host: "localhost",
  // Port number for serve command (default: 9810)
  port:  1234,
  // Use HTTP/2 in serve command (deafult: false)
  http2: true,
  // Settings for HTTPS (HTTP/2). If this property is specified, TLS is used in serve command.
  https: {
    // A path to a private key
    keyPath: "path/to/key.pem",
    // A path to a self-signed certificate
    certPath: "path/to/cert.pem",
  },
}
```

Also see [`examples`](examples).

## Tips

### Batch mode using AWS Lambda

duck provides batch mode that compiles all entry points simultaneously in parallel on AWS Lambda with [faast.js](https://faastjs.org/).

1. Setting AWS credentials in Node.js (See [AWS document](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html))
2. Configure `batchOptions` in `duck.config.js`. It's used for faast.js as [AWSOptions](https://faastjs.org/docs/api/faastjs.awsoptions).
```js
const closureVersion = require('google-closure-compiler/package.json').version;

module.exports = {
  batchOptions: {
    region: 'ap-northeast-1',
    awsLambdaOptions: {
      Runtime: 'nodejs10.x',
    },
    include: ['path/to/your/source/**/*.js'],
    exclude: ['**/*_spec.js'],
    packageJson: {
      dependencies: {
        'google-closure-compiler-linux': closureVersion,
        'google-closure-library': closureVersion,
      },
    },
  },
};
```
3. Run `build` or `build:js` command with `--batch aws`.
```console
$ duck build --batch aws
```

#### How to debug in batch mode?

- Use `--batch local` for [local debugging](https://faastjs.org/docs/local)
- Use `DEBUG=faast:info` or [other log level](https://faastjs.org/docs/workflow#debug-environment-variable) to get more debug information
- Get `logUrl` from debug info and view it in CloudWatch logs
- Use `FAAST_PACKAGE_DIR=foo/bar` to investigate a package sent to Lambda 

Also see [faast.js document](https://faastjs.org/docs/api/faastjs.awsoptions) for more information.

### How to use HTTPS and HTTP2 in `duck serve`?

[Create a self-signed certificate](https://stackoverflow.com/a/10176685) like

```console
$ openssl req -x509 -newkey rsa:4096 -keyout duck-key.pem -out duck-cert.pem -days 365 -nodes -subj '/CN=localhost'
```

Then specify them and enable `http2` in `duck.config.js`.

```js
module.exports = {
  http2: true,
  https: {
    keyPath: './path/to/duck-key.pem',
    certPath: './path/to/duck-cert.pem'
  }
};
```

### bash/zsh-completion for commands and options

Initial setting:

```console
$ duck completion >> ~/.bashrc
# or
$ duck completion >> ~/.zshrc
```

Then, you can complete commands and options with <kbd>TAB</kbd> !

```console
$ duck build:<TAB>
build:deps  -- Generate deps.js
build:js    -- Compile JS files
build:soy   -- Compile Soy templates
```

## License

MIT License: Teppei Sato &lt;teppeis@gmail.com&gt;

[npm-image]: https://img.shields.io/npm/v/@teppeis/duck.svg
[npm-url]: https://npmjs.org/package/@teppeis/duck
[npm-downloads-image]: https://img.shields.io/npm/dm/@teppeis/duck.svg
[deps-image]: https://img.shields.io/david/teppeis/duck.svg
[deps-url]: https://david-dm.org/teppeis/duck
[node-version]: https://img.shields.io/badge/Node.js%20support->=v10.12-brightgreen.svg
[license]: https://img.shields.io/npm/l/@teppeis/duck.svg
[circleci-image]: https://circleci.com/gh/teppeis/duck.svg?style=shield
[circleci-url]: https://circleci.com/gh/teppeis/duck
[codecov-image]: https://codecov.io/gh/teppeis/duck/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/teppeis/duck
