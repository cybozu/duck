import { promises as fs } from "fs";
import path from "path";
import stripJsonComments from "strip-json-comments";
import { Dag, Node } from "./dag.js";

export interface EntryConfig {
  id: string;
  mode: PlovrMode;
  paths: readonly string[];
  inherits?: string;
  inputs?: readonly string[];
  chunks?: {
    [id: string]: {
      // string is normalized to string[]
      inputs: readonly string[];
      // undefined, null and string are normalized to string[]
      deps: readonly string[];
    };
  };
  // like "../compiled/chunks/%s.js",
  "chunk-output-path"?: string;
  // like "/js/compiled/chunks/%s.js"
  "chunk-production-uri"?: string;
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
  { mode }: { mode?: PlovrMode } = {}
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
  { mode }: { mode?: PlovrMode } = {}
): Promise<EntryConfig> {
  const { json: entryConfig, basedir } = await loadInheritedJson(
    entryConfigPath
  );
  // change relative paths to abs paths
  entryConfig.paths = entryConfig.paths.map((p) => path.resolve(basedir, p));
  if (entryConfig.inputs) {
    entryConfig.inputs = entryConfig.inputs.map((input) =>
      path.resolve(basedir, input)
    );
  }
  if (entryConfig.externs) {
    entryConfig.externs = entryConfig.externs.map((extern) =>
      path.resolve(basedir, extern)
    );
  }
  if (entryConfig["output-file"]) {
    entryConfig["output-file"] = path.resolve(
      basedir,
      entryConfig["output-file"]
    );
  }
  if (entryConfig.chunks) {
    Object.values(entryConfig.chunks).forEach((mod) => {
      mod.inputs = mod.inputs.map((input) => path.resolve(basedir, input));
    });
  }
  if (entryConfig.warningsWhitelist) {
    entryConfig.warningsWhitelist.forEach((item) => {
      item.file = path.resolve(basedir, item.file);
    });
  }
  if (entryConfig["test-excludes"]) {
    entryConfig["test-excludes"] = entryConfig["test-excludes"].map((p) =>
      path.resolve(basedir, p)
    );
  }
  if (entryConfig["chunk-output-path"]) {
    entryConfig["chunk-output-path"] = path.resolve(
      basedir,
      entryConfig["chunk-output-path"]
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
  json: EntryConfig | null = null
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
  if (json.chunks) {
    for (const id in json.chunks) {
      if (Object.prototype.hasOwnProperty.call(json.chunks, id)) {
        const chunk = json.chunks[id];
        if (!chunk.inputs) {
          throw new TypeError(`No chunk inputs: ${id}`);
        } else if (!Array.isArray(chunk.inputs)) {
          chunk.inputs = [chunk.inputs];
        }
        if (!chunk.deps) {
          chunk.deps = [];
        } else if (!Array.isArray(chunk.deps)) {
          chunk.deps = [chunk.deps];
        }
      }
    }
  }
  if (json["test-excludes"] && !Array.isArray(json["test-excludes"])) {
    json["test-excludes"] = [json["test-excludes"]];
  }
  return json;
}

export function createDag(entryConfig: EntryConfig): Dag {
  const chunkNodes: Node[] = [];
  for (const id in entryConfig.chunks) {
    if (Object.prototype.hasOwnProperty.call(entryConfig.chunks, id)) {
      const chunk = entryConfig.chunks[id];
      chunkNodes.push(new Node(id, chunk.deps));
    }
  }
  return new Dag(chunkNodes);
}
