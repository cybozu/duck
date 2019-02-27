'use strict';

function toCompilerOptions(entryConfig) {
  const opts = {};
  function copy(entryKey, closureKey = entryKey.replace(/-/g, '_')) {
    if (entryKey in entryConfig) {
      opts[closureKey] = entryConfig[entryKey];
    }
  }
  // TODO: only for page
  opts.dependency_mode = 'PRUNE';
  opts.entry_point = entryConfig.inputs;

  opts.compilation_level = entryConfig.mode;
  opts.js = entryConfig.paths;
  copy('modules');
  copy('externs');
  copy('language-in');
  copy('language-out');
  copy('level', 'warning_level');
  copy('debug');

  const formatting = [];
  if (entryConfig['pretty-print']) {
    formatting.push('PRETTY_PRINT');
  }
  if (entryConfig['print-input-delimiter']) {
    formatting.push('PRINT_INPUT_DELIMITER');
  }
  if (formatting.length > 0) {
    opts.formatting = formatting;
  }

  if (entryConfig.define) {
    const defines = [];
    for (const key in entryConfig.define) {
      const value = entryConfig.define[key];
      defines.push(`${key}=${value}`);
    }
    opts.define = defines;
  }

  // TODO
  // * experimental-compiler-options: Object<string, any>
  // * global-scope-name: `__CBZ__`
  // * soy-function-plugins: string[]
  // * checks: Object<string, string>
  // * output-file: string
  // * module-output-path: string
  // * module-production-uri: string
  return opts;
}

module.exports = toCompilerOptions;
