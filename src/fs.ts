import fs from "fs/promises";
import path from "path";

/**
 * Asynchronously reads the contents of a directory.
 * @param dir The directory
 * @return Absolute paths of the files in the directory excluding '.' and '..'.
 */
export async function readdirRecursive(dir: string) {
  const files = await fs.readdir(dir, { recursive: true });
  return files.map((file) => path.join(dir, file));
}
