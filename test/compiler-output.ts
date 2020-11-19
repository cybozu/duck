import assert = require("assert");
import path from "path";
import fs from "fs";
import tempy from "tempy";
import { CompilerOutput, compileToJson } from "../src/compiler";
import { CompileErrorItem } from "../src/report";

const assertCompileErrorItem = (item: any) => {
  assert(typeof item === "object");
  assert(typeof item.level === "string");
  switch (item.level) {
    case "warning":
    case "error":
      assert(typeof item.description === "string");
      assert(typeof item.key === "string");
      assert(typeof item.line === "number");
      assert(typeof item.column === "number");
      assert(
        typeof item.context === "undefined" || typeof item.context === "string"
      );
      break;

    case "info":
      assert(typeof item.description === "string");
      break;

    default:
      assert.fail(`unknown level: ${item.level}`);
  }
};

describe("compiler output", () => {
  describe("outputs & warnings", () => {
    let outputs: CompilerOutput[] = [];
    let warnings: CompileErrorItem[] = [];
    before(async () => {
      const js = path.resolve(__dirname, "./fixtures/compiler-output/error.js");
      const whitelist = tempy.file({ name: "warnings-whitelist.txt" });
      fs.writeFileSync(whitelist, `${js}:7  inconsistent return type`);

      const [o, w] = await compileToJson({
        compilerOptions: {
          js: [js],
          jscomp_error: ["checkTypes"],
          js_output_file: "out.js",
          warnings_whitelist_file: whitelist,
        },
      });
      outputs = o;
      warnings = w;
    });

    it("outputs is a CompilerOutput[]", () => {
      assert(Array.isArray(outputs));
      for (const output of outputs) {
        assert(typeof output.path === "string");
        assert(typeof output.src === "string");
        assert(typeof output.source_map === "string");
      }
    });

    it("warnings is a CompileErrorItem[]", () => {
      assert(Array.isArray(warnings) && warnings.length > 0);
      for (const warning of warnings) {
        assertCompileErrorItem(warning);
      }
    });
  });

  describe("err.message", () => {
    let first: string = "";
    let second: string = "";
    let rest: string[] = [];
    before(async () => {
      try {
        await compileToJson({
          compilerOptions: {
            js: [
              path.resolve(__dirname, "./fixtures/compiler-output/error.js"),
            ],
            jscomp_error: ["checkTypes"],
            js_output_file: "out.js",
          },
        });
      } catch (err) {
        const [f, s, ...r] = err.message.split("\n");
        first = f;
        second = s;
        rest = r;
        return;
      }

      assert.fail("compileToJson must throw error in this test");
    });

    it("first line is the command excuted by compileToJson", () => {
      assert(/^java -jar/.test(first));
    });

    it("second line is empty", () => {
      assert(second === "");
    });

    describe("rest", () => {
      it("can be parsed as JSON", () => {
        JSON.parse(rest.join("\n"));
      });

      it("JSON is a CompilerErrorItem[]", () => {
        const json = JSON.parse(rest.join("\n"));
        assert(Array.isArray(json));

        for (const item of json) {
          assertCompileErrorItem(item);
        }
      });
    });
  });
});
