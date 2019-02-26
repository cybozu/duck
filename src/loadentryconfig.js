'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');
const stripJsonComments = require('strip-json-comments');

/**
 * Load entry config JSON
 *
 * - strip comments
 * - extend `inherits` recursively
 * - convert relative paths to absolute paths
 */
async function loadEntryConfig(id, entryConfigDir, {mode}) {
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
async function loadInheritedJson(jsonPath, json = null) {
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

module.exports = loadEntryConfig;
