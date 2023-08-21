import chokidar from "chokidar";
import { promises as fs } from "fs";
import path from "path";
import { clearEntryIdToChunkCache } from "./commands/serve.js";
import type { DuckConfig } from "./duckconfig.js";
import { removeDepCacheByPath } from "./gendeps.js";
import { logger } from "./logger.js";
import { calcOutputPath, compileSoy } from "./soy.js";

const chokidarEvents = ["add", "change", "unlink"] as const;

export function watchJsAndSoy(config: DuckConfig) {
  let target = "JS";
  const paths = [`${config.inputsRoot}/**/*.js`];
  const { soyJarPath, soyClasspaths, soyFileRoots, soyOptions } = config;
  let soyConfig: SoyConfig | null = null;
  if (soyJarPath && soyFileRoots && soyOptions) {
    soyConfig = { soyJarPath, soyClasspaths, soyOptions };
    paths.push(...soyFileRoots.map((p) => `${p}/**/*.soy`));
    target = "JS and Soy";
  }
  const ignored = [...config.depsJsIgnoreDirs];
  if (config.depsJs) {
    ignored.push(config.depsJs);
  }
  const watcher = chokidar.watch(paths, { ignored, ignoreInitial: true });
  watcher.on("ready", () =>
    logger.info(`Watching for ${target} file changes...`),
  );
  watcher.on("error", logger.error.bind(logger));
  chokidarEvents.forEach((event) => {
    watcher.on(event, handleChokidarEvent.bind(null, event, soyConfig));
  });
}

function handleChokidarEvent(
  event: (typeof chokidarEvents)[number],
  config: SoyConfig | null,
  filepath: string,
): void {
  if (/\.js$/.test(filepath)) {
    jsHandlers[event](filepath);
  } else if (config && /\.soy$/.test(filepath)) {
    soyHandlers[event](config, filepath);
  }
}

const jsHandlers = {
  add: handleJsUpdated.bind(null, "ADDED"),
  change: handleJsUpdated.bind(null, "CHANGED"),
  unlink: handleJsUpdated.bind(null, "DELETED"),
} as const;

/**
 * This handler just invalidates cache for the updated JS file.
 * The deps.js or chunk cache will be actually updated on the request.
 */
function handleJsUpdated(event: string, filepath: string) {
  logger.info(`[JS_${event}]: ${path.relative(process.cwd(), filepath)}`);
  clearEntryIdToChunkCache();
  removeDepCacheByPath(filepath);
}

const soyHandlers = {
  add: handleSoyUpdated.bind(null, "ADDED"),
  change: handleSoyUpdated.bind(null, "CHANGED"),
  unlink: handleSoyDeleted,
} as const;

type SoyConfig = Required<
  Pick<DuckConfig, "soyJarPath" | "soyClasspaths" | "soyOptions">
>;

async function handleSoyUpdated(
  event: string,
  config: SoyConfig,
  filepath: string,
) {
  logger.info(`[SOY_${event}]: ${path.relative(process.cwd(), filepath)}`);
  return compileSoy([filepath], config);
}

async function handleSoyDeleted(config: SoyConfig, filepath: string) {
  logger.info(`[SOY_DELETED]: ${path.relative(process.cwd(), filepath)}`);
  const outputPath = calcOutputPath(filepath, config.soyOptions);
  await fs.unlink(outputPath);
}
