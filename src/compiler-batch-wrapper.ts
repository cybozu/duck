/**
 * @fileoverview faast.js transforms exported functions in this file to
 * AWS Lambda batch function. So exports and dependencies in this file
 * should be kept to a minimum.
 */

import { splitIntoChunks } from "./compiler-batch-utils";
import type { ExtendedCompilerOptions } from "./compiler-core";
import { compileToJson } from "./compiler-core";

/**
 * The maximum return value size is 256kb.
 * It includes metadata or characters for JSON syntax,
 * so the actual limit for return values is about 220 KB.
 * @see https://faastjs.org/docs/aws#queue-vs-https-mode
 */
const maxChunkSizeInBytes = 220 * 1024;

export async function* compileToJsonStringChunks(
  extendedOpts: ExtendedCompilerOptions
): AsyncGenerator<string, void, undefined> {
  const result = await compileToJson(extendedOpts);
  yield* splitIntoChunks(JSON.stringify(result), maxChunkSizeInBytes);
}
