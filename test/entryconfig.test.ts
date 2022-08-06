import { strict as assert } from "assert";
import path from "path";
import { describe, it } from "vitest";
import { loadEntryConfigById, PlovrMode } from "../src/entryconfig";

const fixturesBaseDir = path.join(__dirname, "fixtures");
const fixturesDir = path.join(fixturesBaseDir, "entryconfig");

describe("entryconfig", () => {
  describe("loadEntryConfig", () => {
    it("loads simple config", async () => {
      const config = await loadEntryConfigById("simple", fixturesDir);
      assert.deepEqual(config, {
        id: "simple",
        mode: "RAW",
        inputs: [path.join(fixturesBaseDir, "js", "foo.js")],
        externs: [
          path.join(fixturesBaseDir, "ext", "foo.js"),
          path.join(fixturesDir, "ext", "bar.js"),
        ],
        paths: [path.join(fixturesBaseDir, "path1")],
        "output-file": path.join(fixturesDir, "out.js"),
        checks: {
          checkRegExp: "ERROR",
          checkTypes: "ERROR",
          checkVars: "WARNING",
          deprecated: "OFF",
        },
      });
    });
    it("overrides `mode`", async () => {
      const config = await loadEntryConfigById("simple", fixturesDir, {
        mode: PlovrMode.ADVANCED,
      });
      assert(config.mode === PlovrMode.ADVANCED);
    });
    it("load chunks config", async () => {
      const config = await loadEntryConfigById("chunks", fixturesDir);
      assert.deepEqual(config, {
        id: "chunks",
        mode: "RAW",
        paths: [path.join(fixturesBaseDir, "path1")],
        chunks: {
          base: {
            inputs: [path.join(fixturesBaseDir, "js", "base.js")],
            deps: [],
          },
          chunk1: {
            inputs: [path.join(fixturesDir, "js", "chunk1.js")],
            deps: ["base"],
          },
        },
        "chunk-output-path": path.join(fixturesBaseDir, "chunks", "%s.js"),
        "chunk-production-uri": "../output/%s.js",
      });
    });
    it("normalizes chunks config", async () => {
      const config = await loadEntryConfigById("chunks-normalize", fixturesDir);
      assert.deepEqual(config, {
        id: "chunks-normalize",
        mode: "RAW",
        paths: [path.join(fixturesBaseDir, "path1")],
        "test-excludes": [fixturesBaseDir],
        chunks: {
          base: {
            inputs: [path.join(fixturesBaseDir, "js", "base.js")],
            deps: [],
          },
          chunk1: {
            inputs: [path.join(fixturesDir, "js", "chunk1.js")],
            deps: ["base"],
          },
        },
      });
    });
    it("inherits parent configs", async () => {
      const config = await loadEntryConfigById(
        "grandchild",
        path.join(fixturesDir, "child", "grandchild")
      );
      assert.deepEqual(config, {
        id: "grandchild",
        mode: "RAW",
        // resolve relative paths based on root json
        inputs: [path.join(fixturesBaseDir, "js", "foo.js")],
        externs: [path.join(fixturesBaseDir, "ext", "foo.js")],
        paths: [path.join(fixturesBaseDir, "path1")],
        debug: true,
        // resolve relative path and normalize in base.json
        "test-excludes": [fixturesBaseDir],
      });
    });
    it("warningsWhitelist", async () => {
      const config = await loadEntryConfigById(
        "warnings-whitelist",
        fixturesDir
      );
      assert.deepEqual(config.warningsWhitelist, [
        {
          file: `${fixturesDir}/path/to/file1.js`,
          line: 1,
          description: "Error1",
        },
        {
          file: `${fixturesDir}/path/to/file2.js`,
          description: "Error2",
        },
      ]);
    });
  });
});
