import { describe, expect, it } from "vitest";
import { splitIntoChunks } from "../src/compiler-batch-utils.js";

describe("splitIntoChunks", () => {
  it("returns an empty array for an empty string", () => {
    const actual = splitIntoChunks("", 3);
    expect(actual).toEqual([]);
  });
  it("throws when max chunk size is zero or negative", () => {
    expect(() => splitIntoChunks("0123456789", 0)).toThrow();
    expect(() => splitIntoChunks("0123456789", -1)).toThrow();
  });
  it("splits into chunks that are equal to or smaller than max chunk size", () => {
    const actual = splitIntoChunks("0123456789", 3);
    expect(actual).toEqual(["012", "345", "678", "9"]);
  });
  it("returns the whole string when max chunk size is larger than the string", () => {
    const actual = splitIntoChunks("0123456789", 20);
    expect(actual).toEqual(["0123456789"]);
  });
  it("throws when max chunk size is smaller than 1 chars bytes in UTF-8", () => {
    expect(() => splitIntoChunks("あいう", 2)).toThrow();
  });
  it("when max chunk size equals to 1 chars bytes in UTF-8", () => {
    const actual = splitIntoChunks("あいう", 3);
    expect(actual).toEqual(["あ", "い", "う"]);
  });
  it("when max chunk size is smaller than 2 chars bytes in UTF-8", () => {
    const actual = splitIntoChunks("あいう", 5);
    expect(actual).toEqual(["あ", "い", "う"]);
  });
  it("when max chunk size equals to 2 chars bytes in UTF-8", () => {
    const actual = splitIntoChunks("あいう", 6);
    expect(actual).toEqual(["あい", "う"]);
  });
  it("surrogate pairs: don't split pairs", () => {
    // "🍎" and "🍊" are 4 bytes in UTF-8
    const actual = splitIntoChunks("🍎🍊", 4);
    expect(actual).toEqual(["🍎", "🍊"]);
  });
  it("surrogate pairs: split pairs", () => {
    // High and low surrogates are 3 bytes in UTF-8
    // So "🍎\ud83c" is 7 bytes.
    const actual = splitIntoChunks("🍎🍊", 7);
    expect(actual).toEqual(["🍎\ud83c", "\udf4a"]);
  });
});
