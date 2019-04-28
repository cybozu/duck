import {promises as fs} from 'fs';
import path from 'path';
import {DuckConfig} from '../duckconfig';
import {generateDepFileTextFromDeps, getDependencies} from '../gendeps';

export async function buildDeps(config: DuckConfig): Promise<void> {
  const paths = [config.inputsRoot];
  const googBaseDir = path.join(config.closureLibraryDir, 'closure', 'goog');
  const fileText = await getDependencies({paths}, config.depsJsIgnoreDirs).then(deps =>
    generateDepFileTextFromDeps(deps, googBaseDir)
  );
  if (config.depsJs) {
    return fs.writeFile(config.depsJs, fileText);
  } else {
    console.log(fileText);
  }
}
