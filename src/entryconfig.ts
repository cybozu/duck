import { promises as fs } from "fs";
import path from "path";
import stripJsonComments from "strip-json-comments";

export interface EntryConfig {
  id: string;
  mode: PlovrMode;
  paths: readonly string[];
  inherits?: string;
  inputs?: readonly string[];
  define?: {
    [key: string]: boolean | number | string;
  };
  externs?: readonly string[];
  "language-in"?: string;
  "language-out"?: string;
  level?: "QUIET" | "DEFAULT" | "VERBOSE";
  debug?: boolean;
  "pretty-print"?: boolean;
  "print-input-delimiter"?: boolean;
  "test-excludes"?: readonly string[];
  "output-file"?: string;
  checks?: {
    [error: string]: "OFF" | "WARNING" | "ERROR";
  };
  "global-scope-name"?: string;
  "output-wrapper"?: string;
  warningsWhitelist?: WarningsWhitelistItem[];
  "experimental-compiler-options"?: { [index: string]: any };
}

export interface WarningsWhitelistItem {
  file: string;
  line?: number;
  description: string;
}

export enum PlovrMode {
  RAW = "RAW",
  WHITESPACE = "WHITESPACE",
  SIMPLE = "SIMPLE",
  ADVANCED = "ADVANCED",
}
/**
 * Load entry config JSON
 *
 * - strip comments
 * - extend `inherits` recursively
 * - convert relative paths to absolute paths
 */
export async function loadEntryConfigById(
  id: string,
  entryConfigDir: string,
  { mode }: { mode?: PlovrMode } = {},
): Promise<EntryConfig> {
  return loadEntryConfig(path.join(entryConfigDir, `${id}.json`), { mode });
}

/**
 * Load entry config JSON
 *
 * - strip comments
 * - extend `inherits` recursively
 * - convert relative paths to absolute paths
 */
export async function loadEntryConfig(
  entryConfigPath: string,
  { mode }: { mode?: PlovrMode } = {},
): Promise<EntryConfig> {
  const { json: entryConfig, basedir } =
    await loadInheritedJson(entryConfigPath);
  // change relative paths to abs paths
  entryConfig.paths = entryConfig.paths.map((p) => path.resolve(basedir, p));
  if (entryConfig.inputs) {
    entryConfig.inputs = entryConfig.inputs.map((input) =>
      path.resolve(basedir, input),
    );
  }
  if (entryConfig.externs) {
    entryConfig.externs = entryConfig.externs.map((extern) =>
      path.resolve(basedir, extern),
    );
  }
  if (entryConfig["output-file"]) {
    entryConfig["output-file"] = path.resolve(
      basedir,
      entryConfig["output-file"],
    );
  }
  if (entryConfig.warningsWhitelist) {
    entryConfig.warningsWhitelist.forEach((item) => {
      item.file = path.resolve(basedir, item.file);
    });
  }
  if (entryConfig["test-excludes"]) {
    entryConfig["test-excludes"] = entryConfig["test-excludes"].map((p) =>
      path.resolve(basedir, p),
    );
  }
  if (mode) {
    entryConfig.mode = mode;
  }
  return entryConfig;
}

/*
 * Load and normalize an EntryConfig JSON file including comments
 */
async function loadJson(jsonPath: string): Promise<EntryConfig> {
  const content = await fs.readFile(path.join(jsonPath), "utf8");
  return normalize(JSON.parse(stripJsonComments(content)));
}

/**
 * Load and extend JSON with `inherits` prop
 */
async function loadInheritedJson(
  jsonPath: string,
  json: EntryConfig | null = null,
): Promise<{ json: EntryConfig; basedir: string }> {
  if (!json) {
    json = await loadJson(jsonPath);
  }
  if (!json.inherits) {
    return { json, basedir: path.dirname(jsonPath) };
  }
  const parentPath = path.resolve(path.dirname(jsonPath), json.inherits);
  const parent = await loadJson(parentPath);
  delete json.inherits;
  json = { ...parent, ...json };
  return loadInheritedJson(parentPath, json);
}

function normalize(json: any): EntryConfig {
  if (json["test-excludes"] && !Array.isArray(json["test-excludes"])) {
    json["test-excludes"] = [json["test-excludes"]];
  }
  return json;
}
