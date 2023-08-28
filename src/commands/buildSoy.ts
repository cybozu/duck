import type { DuckConfig } from "../duckconfig.js";
import { readdirRecursive } from "../fs.js";
import { logger } from "../logger.js";
import { compileSoy } from "../soy.js";

export type BuildSoyConfig = Required<
  Pick<
    DuckConfig,
    "soyFileRoots" | "soyJarPath" | "soyClasspaths" | "soyOptions"
  >
>;

/**
 * @param config
 * @param printConfig Print only
 * @return An array of input Soy template filepaths
 */
export async function buildSoy(
  config: BuildSoyConfig,
  printConfig = false,
): Promise<string[]> {
  logger.info("Finding soy templates");
  const soyFiles = await findSoyFiles(config.soyFileRoots);
  await compileSoy(soyFiles, config, printConfig);
  return soyFiles;
}

async function findSoyFiles(
  soyFileRoots: readonly string[],
): Promise<string[]> {
  const soyFilePromises = soyFileRoots.map(async (root) => {
    const files = await readdirRecursive(root);
    return files.filter((file) => /\.soy$/.test(file));
  });
  const soyFiles = await Promise.all(soyFilePromises);
  return soyFiles.flat();
}
