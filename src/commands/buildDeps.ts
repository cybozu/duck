import { promises as fs } from "fs";
import path from "path";
import { resultInfoLogType } from "../cli";
import { DuckConfig } from "../duckconfig";
import { generateDepFileTextFromDeps, getDependencies } from "../gendeps";
import { logger } from "../logger";

export async function buildDeps(config: DuckConfig): Promise<void> {
  const paths = [config.inputsRoot];
  const googBaseDir = path.join(config.closureLibraryDir, "closure", "goog");
  logger.info(`Analyzing dependencies`);
  const deps = await getDependencies(
    { paths },
    config.depsJsIgnoreDirs.concat(config.closureLibraryDir),
    config.depsWorkers
  );
  logger.info(`Generating deps.js`);
  const fileText = generateDepFileTextFromDeps(deps, googBaseDir);
  if (config.depsJs) {
    await fs.writeFile(config.depsJs, fileText);
    logger.info(`Generated: ${config.depsJs}`);
  } else {
    logger.info({
      msg: "Generated to stdout",
      type: resultInfoLogType,
      title: "Generated deps.js",
      bodyString: fileText
    });
  }
}
