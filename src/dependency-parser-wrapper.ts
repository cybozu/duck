import { depGraph } from "google-closure-deps";
import path from "path";
import workerpool from "workerpool";

// find from the parent directory for ts-node based testing
const script = path.join(__dirname, "../dist/dependency-parser-worker.js");

export class DependencyParserWithWorkers {
  private pool: workerpool.WorkerPool;
  constructor(numOfWorkers = 1) {
    if (numOfWorkers < 1) {
      throw new TypeError(
        `numOfWorkers must be an integer >= 1, but "${numOfWorkers}"`
      );
    }
    this.pool = workerpool.pool(script, {
      minWorkers: "max",
      maxWorkers: numOfWorkers,
    });
  }
  async parse(filepath: string): Promise<depGraph.Dependency> {
    const depData = await this.pool.exec("parseDependency", [filepath]);
    return this.deserialize(depData);
  }

  private deserialize(depData: DependencyTransferData): depGraph.Dependency {
    const imports = depData.imports.map((i) => {
      if (i.isEs6Import && !i.isGoogRequire) {
        return new depGraph.Es6Import(i.symOrPath);
      } else if (!i.isEs6Import && i.isGoogRequire) {
        return new depGraph.GoogRequire(i.symOrPath);
      }
      throw new TypeError(`Unexpected import: ${i}`);
    });
    return new depGraph.Dependency(
      depData.type,
      depData.path,
      depData.closureSymbols,
      imports,
      depData.language
    );
  }

  async terminate(): Promise<any[]> {
    return this.pool.terminate();
  }
}

export interface DependencyTransferData {
  closureSymbols: string[];
  imports: Array<{
    symOrPath: string;
    isEs6Import: boolean;
    isGoogRequire: boolean;
  }>;
  path: string;
  type: depGraph.DependencyType;
  language: string;
}
