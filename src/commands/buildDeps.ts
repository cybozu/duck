import { promises as fs } from "fs";
import path from "path";
import { resultInfoLogType } from "../cli.js";
import type { DuckConfig } from "../duckconfig.js";
import { generateDepFileTextFromDeps, getDependencies } from "../gendeps.js";
import { logger } from "../logger.js";

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
    try {
      await fs.writeFile(config.depsJs, fileText);
    } catch (error: unknown) {
      if ((error as any)?.code === "ENOENT") {
        await fs.mkdir(path.dirname(config.depsJs), { recursive: true });
        await fs.writeFile(config.depsJs, fileText);
      } else {
        throw error;
      }
    }
    logger.info(`Generated: ${config.depsJs}`);
  } else {
    logger.info({
      msg: "Generated to stdout",
      type: resultInfoLogType,
      title: "Generated deps.js",
      bodyString: fileText,
    });
  }
}
