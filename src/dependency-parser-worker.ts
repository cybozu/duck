/* istanbul ignore file */
// This is executed in a worker, so it's hard to instrument.

import workerpool from "workerpool";
import type { DependencyTransferData } from "./dependency-parser-wrapper.js";
import { parseDependency } from "./dependency-parser.js";

async function parse(filepath: string): Promise<DependencyTransferData> {
  const dep = await parseDependency(filepath);
  return {
    closureSymbols: dep.closureSymbols,
    path: dep.path,
    type: dep.type,
    language: dep.language,
    // Don't copy `import.from` to avoid circular dependency in JSON.stringify.
    imports: dep.imports.map((i) => ({
      symOrPath: i.symOrPath,
      // Convert getter methods to properties to transfer with postMessage() to workers.
      isGoogRequire: i.isGoogRequire(),
      isEs6Import: i.isEs6Import(),
    })),
  };
}

workerpool.worker({ parseDependency: parse });
