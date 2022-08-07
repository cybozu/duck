import type { ChildProcess } from "child_process";

/**
 * Types for google-closure-compiler
 * https://github.com/google/closure-compiler-npm
 */

namespace GoogleClosureCompiler {
  class compiler {
    public JAR_PATH: string | null;
    public javaPath: string;
    constructor(
      args: { [idx: string]: string } | string[],
      extraCommandArgs?: string[]
    );
    run(
      callback?: (exitCode: number, stdout: string, stderr: string) => void
    ): ChildProcess;
  }
}

export default GoogleClosureCompiler;
