import assert = require("assert");
import { promises as fs, existsSync } from "fs";
import path from "path";
import tempy from "tempy";
import { JsonReporter } from "../src/reporters/json-reporter";

describe("JsonReporter", () => {
  const entryConfigPath = "/path/to/entry.json";
  const command = "java -jar compiler.jar";

  describe("output()", () => {
    let reporter: JsonReporter;
    let outputDir: string;
    let actualMessage: string | undefined;
    const originalConsoleError = console.error;
    beforeEach(() => {
      outputDir = tempy.directory();
      reporter = new JsonReporter({ outputDir });
      actualMessage = undefined;
      console.error = (message: string) => (actualMessage = message);
    });
    afterEach(() => {
      console.error = originalConsoleError;
    });

    const reasons = [
      {
        entryConfigPath,
        command,
        items: [
          {
            level: "info",
            description: "89 error(s), 5 warning(s), 98.4% typed",
          },
        ],
      },
    ] as const;
    const expected = JSON.stringify(reasons[0]);

    it("makes a directory and a result file", async () => {
      await reporter.output(reasons);
      const actual = await fs.readFile(
        path.join(outputDir, "entry", "results.json"),
        "utf8"
      );
      assert.equal(actual, expected);
      assert.equal(actualMessage, undefined);
    });

    it("does not make any dirs or files", async () => {
      reporter = new JsonReporter({ outputDir: null });
      await reporter.output(reasons);
      assert(!existsSync(path.join(process.cwd(), "test-results")));
      assert.equal(actualMessage, undefined);
    });

    it("outputs to stderr", async () => {
      reporter = new JsonReporter({ outputDir: null, stderr: true });
      await reporter.output(reasons);
      assert.equal(actualMessage, expected);
    });
  });
});
