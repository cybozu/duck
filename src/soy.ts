import execa from "execa";
import { resultInfoLogType } from "./cli";
import { DuckConfig } from "./duckconfig";
import { logger } from "./logger";

export interface SoyToJsOptions {
  outputPathFormat: string;
  shouldGenerateGoogMsgDefs?: boolean;
  shouldGenerateJsdoc?: boolean;
  shouldProvideRequireSoyNamespaces?: boolean;
  bidiGlobalDir?: 1 | -1;
  pluginModules?: readonly string[];
}

type SoyConfig = Required<
  Pick<DuckConfig, "soyJarPath" | "soyClasspaths" | "soyOptions">
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
  await execa("java", soyArgs);
}

export function toSoyArgs(
  soyFiles: readonly string[],
  { soyJarPath, soyClasspaths, soyOptions }: SoyConfig
): string[] {
  const classpaths = [soyJarPath, ...soyClasspaths].join(":");
  const args = [
    "-classpath",
    classpaths,
    "com.google.template.soy.SoyToJsSrcCompiler",
  ];
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
