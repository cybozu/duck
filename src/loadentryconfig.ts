import path from 'path';
import fs from 'fs';
import util from 'util';
import stripJsonComments from 'strip-json-comments';

interface EntryConfig {
  mode: string;
  paths: string[];
  inherits?: string[];
  inputs?: string[];
  modules?: {
    [index: string]: {
      id: string;
      inputs: string[];
      deps: string[];
    };
  };
}

/**
 * Load entry config JSON
 *
 * - strip comments
 * - extend `inherits` recursively
 * - convert relative paths to absolute paths
 */
export default async function loadEntryConfig(id, entryConfigDir, {mode}) {
  const {json: entryConfig, basedir} = await loadInheritedJson(
    path.join(entryConfigDir, `${id}.json`)
  );
  // change relative paths to abs paths
  entryConfig.paths = entryConfig.paths.map(p => path.resolve(basedir, p));
  if (entryConfig.inputs) {
    entryConfig.inputs = entryConfig.inputs.map(input => path.resolve(basedir, input));
  }
  if (entryConfig.modules) {
    Object.values(entryConfig.modules).forEach(mod => {
      mod.inputs = mod.inputs.map(input => path.resolve(basedir, input));
    });
  }
  if (mode) {
    entryConfig.mode = mode;
  }
  return entryConfig;
}

/*
 * Load JSON file including comments
 */
async function loadJson(jsonPath) {
  const content = await util.promisify(fs.readFile)(path.join(jsonPath), 'utf8');
  return JSON.parse(stripJsonComments(content));
}

/**
 * Load and extend JSON with `inherits` prop
 */
async function loadInheritedJson(
  jsonPath,
  json = null
): Promise<{json: EntryConfig; basedir: string}> {
  if (!json) {
    json = await loadJson(jsonPath);
  }
  if (!json.inherits) {
    return {json, basedir: path.dirname(jsonPath)};
  }
  const parentPath = path.resolve(path.dirname(jsonPath), json.inherits);
  const parent = await loadJson(parentPath);
  delete json.inherits;
  json = {...parent, ...json};
  return loadInheritedJson(parentPath, json);
}
