import { rimraf } from "rimraf";

export async function cleanDeps(depsJsPath: string): Promise<boolean> {
  return rimraf(depsJsPath);
}
