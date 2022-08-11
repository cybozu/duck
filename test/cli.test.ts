import { strict as assert } from "assert";
import { it } from "vitest";
import { run } from "../src/cli.js";

it("run is an exported function", () => {
  assert(typeof run === "function");
});
