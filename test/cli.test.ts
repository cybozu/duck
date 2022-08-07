import { strict as assert } from "assert";
import { describe, it } from "vitest";
import { run } from "../src/cli";

describe("cli", () => {
  it("run is an exported function", () => {
    assert(typeof run === "function");
  });
});
