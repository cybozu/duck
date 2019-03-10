import path from 'path';
import fs from 'fs';
import util from 'util';
import stripJsonComments from 'strip-json-comments';

export interface EntryConfig {
  id: string;
  mode: PlovrMode;
  paths: string[];
  inherits?: string;
  inputs?: string[];
  modules?: {
    [id: string]: {
      // string is normalized to string[]
      inputs: string[];
      // undefined, null and string are normalized to string[]
      deps: string[];
    };
  };
  define?: {
    [key: string]: string;
  };
  externs?: string[];
  'language-in'?: string;
  'language-out'?: string;
  level?: 'QUIET' | 'DEFAULT' | 'VERBOSE';
  debug?: boolean;
  'pretty-print'?: boolean;
  'print-input-delimiter'?: boolean;
}

export enum PlovrMode {
  RAW = 'RAW',
  WHITESPACE = 'WHITESPACE',
  SIMPLE = 'SIMPLE',
  ADVANCED = 'ADVANCED',
}

/**
 * Load entry config JSON
 *
 * - strip comments
 * - extend `inherits` recursively
 * - convert relative paths to absolute paths
 */
export async function loadEntryConfig(
  id: string,
  entryConfigDir: string,
  {mode}: {mode?: PlovrMode} = {}
): Promise<EntryConfig> {
  const {json: entryConfig, basedir} = await loadInheritedJson(
    path.join(entryConfigDir, `${id}.json`)
  );
  // change relative paths to abs paths
  entryConfig.paths = entryConfig.paths.map(p => path.resolve(basedir, p));
  if (entryConfig.inputs) {
    entryConfig.inputs = entryConfig.inputs.map(input => path.resolve(basedir, input));
  }
  if (entryConfig.externs) {
    entryConfig.externs = entryConfig.externs.map(extern => path.resolve(basedir, extern));
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
async function loadJson(jsonPath: string): Promise<any> {
  const content = await util.promisify(fs.readFile)(path.join(jsonPath), 'utf8');
  return JSON.parse(stripJsonComments(content));
}

/**
 * Load and extend JSON with `inherits` prop
 */
async function loadInheritedJson(
  jsonPath: string,
  json: EntryConfig | null = null
): Promise<{json: EntryConfig; basedir: string}> {
  if (!json) {
    json = normalize(await loadJson(jsonPath));
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

function normalize(json: any): EntryConfig {
  if (json.modules) {
    for (const id in json.modules) {
      const module = json.modules[id];
      if (!module.inputs) {
        throw new TypeError(`No module inputs: ${id}`);
      } else if (!Array.isArray(module.inputs)) {
        module.inputs = [module.inputs];
      }
      if (!module.deps) {
        module.deps = [];
      } else if (!Array.isArray(module.deps)) {
        module.deps = [module.deps];
      }
    }
  }
  return json;
}
