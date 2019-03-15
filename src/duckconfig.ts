import path from 'path';

interface DuckConfig {
  closureLibraryDir: string;
  inputsRoot: string;
  entryConfigDir: string;
}

export function loadConfig(configDir = process.cwd()): DuckConfig {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config: DuckConfig = require(path.join(configDir, 'duck.config'));
  // resolve relative path to absolute
  config.closureLibraryDir = path.resolve(configDir, config.closureLibraryDir);
  config.inputsRoot = path.resolve(configDir, config.inputsRoot);
  config.entryConfigDir = path.resolve(configDir, config.entryConfigDir);
  return config;
}
