import path from "path";
import { fileURLToPath } from "url";
import { strict as assert } from "assert";
import { describe, it } from "vitest";
import { listSoyDependencies } from "../src/watch.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesBaseDir = path.join(__dirname, "fixtures");

describe("listSoyDependencies", () => {
  const fixturesDir = path.join(fixturesBaseDir, "listSoyDependencies");

  it("lists all the dependencies", async () => {
    const actual = await listSoyDependencies(
      path.join(fixturesDir, "1.soy"),
      fixturesDir,
    );
    assert.deepEqual(actual, [
      path.join(fixturesDir, "1.soy"),
      path.join(fixturesDir, "2.soy"),
      path.join(fixturesDir, "4.soy"),
      path.join(fixturesDir, "3.soy"),
    ]);
  });

  it("returns the given file with no dependencies", async () => {
    const actual = await listSoyDependencies(
      path.join(fixturesDir, "4.soy"),
      fixturesDir,
    );
    assert.deepEqual(actual, [path.join(fixturesDir, "4.soy")]);
  });
});
