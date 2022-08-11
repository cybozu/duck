/**
 * @fileoverview This file is bundled with webpack and executed in AWS
 * Lambda. Exports and dependencies in this file should be kept to a minimum.
 */

import { strict as assert } from "assert";

export function splitIntoChunks(
  str: string,
  maxChunkSizeInBytes: number
): string[] {
  assert(maxChunkSizeInBytes > 0);
  const chunks: string[] = [];
  let length: number;
  for (let start = 0; start < str.length; start += length) {
    length = maxChunkSizeInBytes;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const chunk = str.substring(start, start + length);
      if (Buffer.byteLength(chunk, "utf8") <= maxChunkSizeInBytes) {
        chunks.push(chunk);
        break;
      }
      length = Math.floor(length * 0.95);
      if (length === 0) {
        throw new TypeError(
          `maxChunkSizeInBytes: ${maxChunkSizeInBytes} is too small`
        );
      }
    }
  }
  return chunks;
}
