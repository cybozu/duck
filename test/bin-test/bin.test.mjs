import { strict as assert } from "assert";
import { execFile } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { describe, it } from "vitest";

const execFileP = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const bin = resolve(__dirname, "..", "..", "bin", "duck.js");

// Run this test after tsc
describe("bin/duck.js", () => {
  it("is executable", async () => {
    const { stderr } = await execFileP(bin, ["--help"]);
    assert.equal(stderr, "");
  }, 10000);
});
