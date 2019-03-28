/**
 * Types for google-closure-deps
 */
export namespace parser {
  export class ParseResult {
    /** @const */
    dependencies: depGraph.Dependency[];
    /** @const */
    errors: ParseError[];
    /** @const */
    hasFatalError: boolean;
    /** @const */
    source: ParseResult.Source;
    /** @const */
    isFromDepsFile: boolean;
    constructor(
      dependencies: depGraph.Dependency[],
      errors: ParseError[],
      source: ParseResult.Source
    );
  }

  namespace ParseResult {
    // TODO: workaround for a bug of @typescript-eslint
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    enum Source {
      /**
       * Scanned from an actual source file.
       */
      SOURCE_FILE = 'f',

      /**
       * A goog.addDependency statement.
       */
      GOOG_ADD_DEPENDENCY = 'd',
    }
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

  /**
   * Parses a file that contains only goog.addDependency statements. This is regex
   * based to be lightweight and avoid addtional dependencies.
   */
  export function parseDependencyFile(text: string, filePath: string): ParseResult;
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
    abstract validate(to: Dependency): void;
    abstract isGoogRequire(): boolean;
    abstract isEs6Import(): boolean;
  }

  export class GoogRequire extends Import {
    validate(to: Dependency): void;
    isGoogRequire(): true;
    isEs6Import(): false;
  }

  export class Es6Import extends Import {
    validate(to: Dependency): void;
    isGoogRequire(): true;
    isEs6Import(): false;
  }

  /**
   * Interface for resolving module specifiers.
   */
  export interface ModuleResolver {
    /**
     * @param fromPath The path of the module that is doing the
     *     importing.
     * @param importSpec The raw text of the import.
     * @return The resolved path of the referenced module.
     */
    resolve(fromPath: string, importSpec: string): string;
  }

  /**
   * Dependency graph that provides validation along with a topological sorting
   * of dependencies given an entrypoint.
   *
   * A dependency graph is not validated by default, you must call validate() if
   * you wish to perform validation.
   */
  export class Graph {
    /** @const */
    depsBySymbol: Map<string, Dependency>;
    /** @const */
    depsByPath: Map<string, Dependency>;
    /** @const */
    moduleResolver: ModuleResolver;

    constructor(dependencies: Dependency[], moduleResolver?: ModuleResolver);

    /**
     * Validates the dependency graph. Throws an error if the graph is invalid.
     *
     * This method uses Tarjan's algorithm to ensure Closure files are not part
     * of any cycle. Check it out:
     * https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     */
    validate(): void;

    private resolve_(i: Import): Dependency;

    /**
     * Provides a topological sorting of dependencies given the entrypoints.
     */
    order(...entrypoints: Dependency[]): Dependency[];
  }
}

export namespace depFile {
  /**
   * Gets the text of a dependency file for the given dependencies.
   *
   * @param pathToClosure The path to Closure Library. Required as paths
   *      in goog.addDependency statements are relative to Closure's base.js.
   * @param dependencies
   * @param moduleResolver
   * @return
   */
  export function getDepFileText(
    pathToClosure: string,
    dependencies: depGraph.Dependency[],
    moduleResolver?: depGraph.ModuleResolver
  ): string;
}
