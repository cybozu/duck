import { strict as assert } from "assert";
import { run } from "../src/cli";

describe("cli", () => {
  it("run is an exported function", () => {
    assert(typeof run === "function");
  });
});
