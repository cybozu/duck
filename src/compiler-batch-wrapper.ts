/**
 * @fileoverview faast.js transforms exported functions in this file to
 * AWS Lambda batch function. So exports and dependencies in this file
 * should be kept to a minimum.
 */

import assert from "assert";
import { splitIntoChunks } from "./compiler-batch-utils.js";
import type { ExtendedCompilerOptions } from "./compiler-core.js";
import { compileToJson } from "./compiler-core.js";

export const FAAST_URL = import.meta.url;

/**
 * The maximum return value size is 256kb.
 * It includes metadata or characters for JSON syntax,
 * so the actual limit for return values is about 220 KB.
 * @see https://faastjs.org/docs/aws#queue-vs-https-mode
 */
const maxChunkSizeInBytes = 200 * 1024;

export async function* compileToJsonStringChunks(
  extendedOpts: ExtendedCompilerOptions
): AsyncGenerator<string, void, undefined> {
  const result = await compileToJson(extendedOpts);
  const size = extendedOpts.batchMaxChunkSize ?? maxChunkSizeInBytes;
  assert(size <= 256 * 1024);
  yield* splitIntoChunks(JSON.stringify(result), size);
}
