import assert from "assert";
import execa from "execa";
import path from "path";
import { assertString } from "./assert.js";
import { resultInfoLogType } from "./cli.js";
import type { DuckConfig } from "./duckconfig.js";
import { logger } from "./logger.js";
import { toAbsPath, toAbsPathArray } from "./pathutils.js";

type SoyToJsOptionsCore = {
  outputPathFormat?: string;
  outputDirectory?: string;
  inputRoots?: string[];
};

export type SoyToJsOptions = SoyToJsOptionsCore &
  Record<string, boolean | string | number | string[]>;

type SoyConfig = Pick<
  DuckConfig,
  "soyJarPath" | "soyClasspaths" | "soyOptions" | "soySrcsRelativeFrom"
>;

export async function compileSoy(
  soyFiles: readonly string[],
  config: SoyConfig,
  printConfig = false
): Promise<void> {
  const soyArgs = toSoyArgs(soyFiles, config);
  if (printConfig) {
    logger.info({
      msg: "Print config only",
      type: resultInfoLogType,
      title: "Soy config",
      bodyObject: soyArgs,
    });
    return;
  }
  logger.info("Compiling soy templates");
  let opt: execa.Options = {};
  if (config.soySrcsRelativeFrom) {
    opt = { cwd: config.soySrcsRelativeFrom };
  }
  await execa("java", soyArgs, opt);
}

export function toSoyArgs(
  soyFiles: readonly string[],
  { soyJarPath, soyClasspaths, soyOptions, soySrcsRelativeFrom }: SoyConfig
): string[] {
  assert(soyJarPath);
  soyOptions = { ...soyOptions };
  const classpaths = [soyJarPath, ...soyClasspaths].join(":");
  const args = [
    "-classpath",
    classpaths,
    "com.google.template.soy.SoyToJsSrcCompiler",
  ];
  if (soySrcsRelativeFrom) {
    soyFiles = soyFiles.map((soyFile) =>
      path.relative(soySrcsRelativeFrom, soyFile)
    );
    const { outputDirectory, inputRoots } = soyOptions;
    if (outputDirectory) {
      soyOptions.outputDirectory = path.relative(
        soySrcsRelativeFrom,
        outputDirectory
      );
    }
    if (inputRoots) {
      soyOptions.inputRoots = inputRoots.map((inputRoot) =>
        path.relative(soySrcsRelativeFrom, inputRoot)
      );
    }
  }
  Object.entries(soyOptions).forEach(([key, value]) => {
    if (typeof value === "boolean" && value) {
      args.push(`--${key}`);
    } else if (typeof value === "string" || typeof value === "number") {
      args.push(`--${key}`, String(value));
    } else if (Array.isArray(value)) {
      args.push(`--${key}`, value.join(","));
    } else {
      throw new TypeError(`Unsupported soy config value: "${key}: ${value}"`);
    }
  });
  args.push("--srcs", soyFiles.join(","));
  return args;
}

/**
 * Return output JS file path for the Soy file.
 * NOTE: duck doesn't support {LOCALE} and {LOCALE_LOWER_CASE}.
 * @param soyFilePath an absolute path to .soy file
 * @param soyOptions
 * @return a path to an output JS file for the .soy file
 */
export function calcOutputPath(
  soyFilePath: string,
  soyOptions: DuckConfig["soyOptions"]
): string {
  if (!path.isAbsolute(soyFilePath)) {
    throw new TypeError("soyFilePath must be an absolute path: " + soyFilePath);
  }
  const { outputPathFormat, outputDirectory } = soyOptions;
  if (outputPathFormat) {
    return calcOutputPathFormat(soyFilePath, soyOptions);
  } else if (outputDirectory) {
    return calcOutputDirectory(soyFilePath, soyOptions);
  }
  throw new TypeError("Must set either outputPathFormat or outputDirectory");
}

function calcOutputPathFormat(
  soyFilePath: string,
  soyOptions: DuckConfig["soyOptions"]
): string {
  const { outputPathFormat } = soyOptions;
  const inputDirectory = path.dirname(soyFilePath) + path.sep;
  const inputFileName = path.basename(soyFilePath);
  const inputFileNameNoExt = inputFileName.slice(
    0,
    -path.extname(inputFileName).length
  );
  return resolveOutputPathFormat(assertString(outputPathFormat), {
    inputDirectory,
    inputFileName,
    inputFileNameNoExt,
  });
}

/**
 * NOTE: duck doesn't support {LOCALE} and {LOCALE_LOWER_CASE}.
 */
export function resolveOutputPathFormat(
  outputPathFormat: string,
  {
    inputDirectory,
    inputFileName,
    inputFileNameNoExt,
  }: {
    inputDirectory: string;
    inputFileName: string;
    inputFileNameNoExt: string;
  }
): string {
  const outputPath = outputPathFormat
    .replace("{INPUT_DIRECTORY}", inputDirectory)
    .replace("{INPUT_FILE_NAME}", inputFileName)
    .replace("{INPUT_FILE_NAME_NO_EXT}", inputFileNameNoExt);
  return outputPath;
}

export function normalizeSoyOptoins(config: DuckConfig, configDir: string) {
  config.soyOptions ||= {};
  const { soyOptions } = config;
  if (soyOptions.outputDirectory && soyOptions.outputPathFormat) {
    throw new TypeError("Must set either outputPathFormat or outputDirectory");
  }
  if (typeof soyOptions.inputRoots === "string") {
    soyOptions.inputRoots = (soyOptions.inputRoots as string).split(",");
  }
  // NOTE: cannot change outputPathFormat to absolute.
  toAbsPath(soyOptions as SoyToJsOptionsCore, configDir, "outputDirectory");
  toAbsPathArray(soyOptions as SoyToJsOptionsCore, configDir, "inputRoots");
}

function calcOutputDirectory(
  soyFilePath: string,
  soyOptions: DuckConfig["soyOptions"]
): string {
  if (!path.isAbsolute(soyFilePath)) {
    throw new TypeError("soyFilePath must be an absolute path: " + soyFilePath);
  }
  const { outputDirectory, inputRoots } = soyOptions;
  if (!outputDirectory || !path.isAbsolute(outputDirectory)) {
    throw new TypeError(
      "outputDirectory must be an absolute path: " + outputDirectory
    );
  }
  for (const inputRoot of inputRoots || []) {
    if (!path.isAbsolute(inputRoot)) {
      throw new TypeError("inputRoots must be an absolute path: " + inputRoot);
    }
    if (soyFilePath.startsWith(inputRoot)) {
      soyFilePath = path.relative(inputRoot, soyFilePath);
      break;
    }
  }
  const outputPath = path.resolve(outputDirectory, soyFilePath);
  if (!soyFilePath.endsWith(".soy")) {
    throw new TypeError(
      `Soy filename must be end with ".soy", but actually "${soyFilePath}".`
    );
  }
  return `${outputPath}.js`;
}
