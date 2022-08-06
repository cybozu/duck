import rimraf from "rimraf";
import util from "util";
import { assertString } from "../assert";
import { DuckConfig } from "../duckconfig";
import { logger } from "../logger";
import { resolveOutputPathFormat } from "../soy";

export type CleanSoyConfig = Required<Pick<DuckConfig, "soyOptions">>;

export async function cleanSoy(config: CleanSoyConfig): Promise<string> {
  const { outputPathFormat, outputDirectory } = config.soyOptions;
  let outputPath = outputDirectory;
  if (!outputPath && outputPathFormat) {
    outputPath = resolveOutputPathFormat(assertString(outputPathFormat), {
      inputDirectory: "/**/",
      inputFileName: "*",
      inputFileNameNoExt: "*",
    });
  } else {
    throw new TypeError("Must set either outputPathFormat or outputDirectory");
  }
  logger.info(`rm ${outputPath}`);
  await util.promisify(rimraf)(outputPath);
  return outputPath;
}
