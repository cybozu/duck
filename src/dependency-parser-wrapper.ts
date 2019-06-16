import {depGraph} from 'google-closure-deps';
import path from 'path';
import workerpool from 'workerpool';

const script = path.join(__dirname, '../lib/dependency-parser-worker.js');

export class DependencyParserWithWorkers {
  private pool: workerpool.WorkerPool;
  constructor() {
    this.pool = workerpool.pool(script, {minWorkers: 'max', maxWorkers: 2});
  }
  async parse(filepath: string): Promise<depGraph.Dependency> {
    const depData = await this.pool.exec('parseDependency', [filepath]);
    return this.deserialize(depData);
  }

  private deserialize(depData: DependencyTransferData): depGraph.Dependency {
    const imports = depData.imports.map(i => {
      if (i.isEs6Import && !i.isGoogRequire) {
        return new depGraph.Es6Import(i.symOrPath);
      } else if (!i.isEs6Import && i.isGoogRequire) {
        return new depGraph.GoogRequire(i.symOrPath);
      } else {
        throw new TypeError(`Unexpected import: ${i}`);
      }
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
  imports: {
    symOrPath: string;
    isEs6Import: boolean;
    isGoogRequire: boolean;
  }[];
  path: string;
  type: depGraph.DependencyType;
  language: string;
}
