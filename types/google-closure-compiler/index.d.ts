import {ChildProcess} from 'child_process';

/**
 * Types for google-closure-compiler
 * https://github.com/google/closure-compiler-npm
 */

export class compiler {
  public JAR_PATH: string | null;
  public javaPath: string;
  constructor(args: {[idx: string]: string} | string[], extraCommandArgs?: string[]);
  run(callback?: (exitCode: number, stdout: string, stderr: string) => void): ChildProcess;
}
