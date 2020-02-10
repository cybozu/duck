import { depGraph, parser } from "google-closure-deps";

/**
 * Parse a script file including such as `goog.provide` and generate a `Dependency`.
 */
export async function parseDependency(
  filepath: string
): Promise<depGraph.Dependency> {
  const result = await parser.parseFileAsync(filepath);
  if (result.hasFatalError) {
    throw new Error(`Fatal parse error in ${filepath}: ${result.errors}`);
  }
  if (result.dependencies.length > 1) {
    throw new Error(`A JS file must have only one dependency: ${filepath}`);
  }
  if (result.dependencies.length === 0) {
    throw new Error(`No dependencies found: ${filepath}`);
  }
  return result.dependencies[0];
}
