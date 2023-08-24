import { rimraf } from "rimraf";
import { assertString } from "../assert.js";
import type { DuckConfig } from "../duckconfig.js";
import { logger } from "../logger.js";
import { resolveOutputPathFormat } from "../soy.js";

export type CleanSoyConfig = Required<Pick<DuckConfig, "soyOptions">>;

export async function cleanSoy(config: CleanSoyConfig): Promise<string> {
  const { outputPathFormat, outputDirectory } = config.soyOptions;
  let outputPath = outputDirectory;
  if (!outputPath) {
    if (outputPathFormat) {
      outputPath = resolveOutputPathFormat(assertString(outputPathFormat), {
        inputDirectory: "/**/",
        inputFileName: "*",
        inputFileNameNoExt: "*",
      });
    } else {
      throw new TypeError(
        "Must set either outputPathFormat or outputDirectory",
      );
    }
  }
  logger.info(`rm ${outputPath}`);
  await rimraf(outputPath);
  return outputPath;
}
