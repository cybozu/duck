/**
 * Types for google-closure-deps
 */
export namespace parser {
  export class ParseResult {
    /** @const */
    dependency: depGraph.Dependency;
    /** @const */
    errors: ParseError[];
    /** @const */
    hasFatalError: boolean;
    constructor(dependency: depGraph.Dependency, errors: ParseError[]);
  }
  export class ParseError {
    /** @const */
    fatal: boolean;
    /** @const */
    message: string;
    /** @const */
    sourceName: string;
    /** @const */
    line: number;
    /** @const */
    lineOffset: number;
    constructor(
      fatal: boolean,
      message: string,
      sourceName: string,
      line: number,
      lineOffset: number
    );
  }
  export function parseFileAsync(path: string): Promise<ParseResult>;
}

export namespace depGraph {
  export enum DependencyType {
    /** A file containing goog.provide statements. */
    CLOSURE_PROVIDE = 'closure provide',
    /** A file containing a goog.module statement. */
    CLOSURE_MODULE = 'closure module',
    /** An ES6 module file. */
    ES6_MODULE = 'es6 module',
    /** A JavaScript file that has no goog.provide/module and is not an ES6 module. */
    SCRIPT = 'script',
  }

  /**
   * A Dependency in the dependency graph (a vertex).
   */
  export class Dependency {
    /** @const */
    type: DependencyType;
    /**
     * Full path of this file on disc.
     * @const
     */
    path: string;
    /**
     * Array of Closure symbols this file provides.
     * @const
     */
    closureSymbols: string[];
    /**
     * Array of imports in this file.
     * @const
     */
    imports: Import[];
    /**
     * The language level of this file; e.g. "es3", "es6", etc.
     * @const
     */
    language: string | null;
    constructor(
      type: DependencyType,
      filepath: string,
      closureSymbols: string[],
      imports: Import[],
      language?: string
    );
  }

  /**
   * Generic super class for all types of imports. This acts as an edge in the
   * dependency graph between two dependencies.
   */
  export abstract class Import {
    /**
     * Dependency this import is contained in.
     */
    from: Dependency;
    /**
     * The Closure symbol or path that is required.
     * @const
     */
    symOrPath: string;
    constructor(symOrPath: string);
    /**
     * Asserts that this import edge is valid.
     */
    abstract validate(to: Dependency);
    abstract isGoogRequire(): boolean;
    abstract isEs6Import(): boolean;
  }

  /**
   * Interface for resolving module specifiers.
   */
  export interface ModuleResolver {
    /**
     * @param {string} fromPath The path of the module that is doing the
     *     importing.
     * @param {string} importSpec The raw text of the import.
     * @return {string} The resolved path of the referenced module.
     */
    resolve(fromPath, importSpec): string;
  }
}

export namespace depFile {
  /**
   * Gets the text of a dependency file for the given dependencies.
   *
   * @param {string} pathToClosure The path to Closure Library. Required as paths
   *      in goog.addDependency statements are relative to Closure's base.js.
   * @param {!Array<!depGraph.Dependency>} dependencies
   * @param {!depGraph.ModuleResolver=} moduleResolver
   * @return {string}
   */
  export function getDepFileText(
    pathToClosure: string,
    dependencies: depGraph.Dependency[],
    moduleResolver?: depGraph.ModuleResolver
  ): string;
}
