import rimraf from "rimraf";
import util from "util";
import { DuckConfig } from "../duckconfig";
import { logger } from "../logger";

export type CleanSoyConfig = Required<Pick<DuckConfig, "soyOptions">>;

export async function cleanSoy(config: CleanSoyConfig): Promise<string> {
  const { outputPathFormat } = config.soyOptions;
  const outputPath = outputPathFormat
    .replace("{INPUT_DIRECTORY}", "/**/")
    .replace("{INPUT_FILE_NAME}", "*")
    .replace("{INPUT_FILE_NAME_NO_EXT}", "*")
    .replace("{LOCALE}", "*")
    .replace("{LOCALE_LOWER_CASE}", "*");
  logger.info(`rm ${outputPath}`);
  await util.promisify(rimraf)(outputPath);
  return outputPath;
}
