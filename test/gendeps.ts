import assert = require('assert');
import {depGraph} from 'google-closure-deps';
import path from 'path';
import {
  generateDepFileText,
  addClosureDependency,
  getClosureLibraryDependencies,
  getDependencies,
} from '../src/gendeps';
import {EntryConfig, PlovrMode} from '../src/entryconfig';

const closureLibraryDir = '/closure-library-test';
const fixturesBaseDir = path.join(__dirname, 'fixtures');

describe('gendeps', () => {
  describe('generateDepFileText()', () => {
    it('returns correct path', async () => {
      const inputsRoot = path.join(fixturesBaseDir, 'generateDepFileText');
      const closureDir = path.join(inputsRoot, 'closure');
      const entryConfig: EntryConfig = {
        id: `foo-${Math.random()}`,
        mode: PlovrMode.RAW,
        paths: [inputsRoot],
        inputs: [path.join(inputsRoot, 'foo', 'init.js')],
      };
      const result = await generateDepFileText(entryConfig, closureDir, inputsRoot);
      assert.equal(
        result,
        "goog.addDependency('../../../../foo/init.js', ['foo.init'], ['foo.bar', 'goog.array'], {});\n"
      );
    });
  });
  describe('getDependencies()', () => {
    const fixturesDir = path.join(fixturesBaseDir, 'getDependencies');
    function createScriptDependency(filepath: string): any {
      return {
        type: depGraph.DependencyType.SCRIPT,
        closureSymbols: [],
        imports: [],
        language: 'es3',
        path: path.join(fixturesDir, filepath),
      };
    }
    it('loads all js files in paths', async () => {
      const path1 = path.join(fixturesDir, 'path1');
      const path2 = path.join(fixturesDir, 'path2');
      const closureDir = path.join(fixturesDir, 'closure');
      const entryConfig: EntryConfig = {
        id: `foo-${Math.random()}`,
        mode: PlovrMode.RAW,
        paths: [path1, path2, closureDir],
      };
      const results = await getDependencies(entryConfig);
      assert.deepEqual(
        new Set(results),
        new Set([
          createScriptDependency('path1/foo.js'),
          createScriptDependency('path1/foo_test.js'),
          createScriptDependency('path2/bar.js'),
          createScriptDependency('path2/bar_test.js'),
          createScriptDependency('closure/baz.js'),
        ])
      );
    });
    it('ignoreDir', async () => {
      const path1 = path.join(fixturesDir, 'path1');
      const path2 = path.join(fixturesDir, 'path2');
      const closureDir = path.join(fixturesDir, 'closure');
      const entryConfig: EntryConfig = {
        id: `foo-${Math.random()}`,
        mode: PlovrMode.RAW,
        paths: [path1, path2, closureDir],
      };
      const results = await getDependencies(entryConfig, closureDir);
      assert.deepEqual(
        new Set(results),
        new Set([
          createScriptDependency('path1/foo.js'),
          createScriptDependency('path1/foo_test.js'),
          createScriptDependency('path2/bar.js'),
          createScriptDependency('path2/bar_test.js'),
        ])
      );
    });
    it('test-excludes', async () => {
      const path1 = path.join(fixturesDir, 'path1');
      const path2 = path.join(fixturesDir, 'path2');
      const closureDir = path.join(fixturesDir, 'closure');
      const entryConfig: EntryConfig = {
        id: `foo-${Math.random()}`,
        mode: PlovrMode.RAW,
        paths: [path1, path2, closureDir],
        'test-excludes': [path2],
      };
      const results = await getDependencies(entryConfig, closureDir);
      assert.deepEqual(
        new Set(results),
        new Set([
          createScriptDependency('path1/foo.js'),
          createScriptDependency('path1/foo_test.js'),
          createScriptDependency('path2/bar.js'),
        ])
      );
    });
  });
  describe('addDependency()', () => {
    it('closure module', () => {
      const dep = addClosureDependency(
        'async/animationdelay_test.js',
        ['goog.async.AnimationDelayTest'],
        ['goog.Promise', 'goog.Timer'],
        {module: 'goog'},
        closureLibraryDir
      );
      assert.deepEqual(dep, {
        type: depGraph.DependencyType.CLOSURE_MODULE,
        path: `${closureLibraryDir}/closure/goog/async/animationdelay_test.js`,
        closureSymbols: ['goog.async.AnimationDelayTest'],
        imports: [{symOrPath: 'goog.Promise', from: dep}, {symOrPath: 'goog.Timer', from: dep}],
        language: 'es3',
      });
    });
    it('closure script', () => {
      const dep = addClosureDependency(
        'dom/textrange.js',
        ['goog.dom.TextRange'],
        ['goog.array', 'goog.dom'],
        {},
        closureLibraryDir
      );
      assert.deepEqual(dep, {
        type: depGraph.DependencyType.CLOSURE_PROVIDE,
        path: `${closureLibraryDir}/closure/goog/dom/textrange.js`,
        closureSymbols: ['goog.dom.TextRange'],
        imports: [{symOrPath: 'goog.array', from: dep}, {symOrPath: 'goog.dom', from: dep}],
        language: 'es3',
      });
    });
    it('lang', () => {
      const dep = addClosureDependency(
        'events/keys.js',
        ['goog.events.Keys'],
        [],
        {
          lang: 'es5',
        },
        closureLibraryDir
      );
      assert.deepEqual(dep, {
        type: depGraph.DependencyType.CLOSURE_PROVIDE,
        path: `${closureLibraryDir}/closure/goog/events/keys.js`,
        closureSymbols: ['goog.events.Keys'],
        imports: [],
        language: 'es5',
      });
    });
    it('third_party', () => {
      const dep = addClosureDependency(
        '../../third_party/closure/goog/dojo/dom/query.js',
        ['goog.dom.query'],
        [],
        {},
        closureLibraryDir
      );
      assert.deepEqual(dep, {
        type: depGraph.DependencyType.CLOSURE_PROVIDE,
        path: `${closureLibraryDir}/third_party/closure/goog/dojo/dom/query.js`,
        closureSymbols: ['goog.dom.query'],
        imports: [],
        language: 'es3',
      });
    });
  });
  describe('getClosureLibraryDependencies()', () => {
    it('loads deps of closure-library from the deps.js', async () => {
      const closureLib1 = path.resolve(fixturesBaseDir, 'closure-lib1');
      const deps = await getClosureLibraryDependencies(closureLib1);
      assert.deepEqual(deps, [
        {
          type: depGraph.DependencyType.CLOSURE_PROVIDE,
          path: `${closureLib1}/closure/goog/a11y/aria/aria.js`,
          closureSymbols: ['goog.a11y.aria'],
          imports: [{symOrPath: 'goog.a11y.aria.Role', from: deps[0]}],
          language: 'es3',
        },
        {
          type: depGraph.DependencyType.CLOSURE_MODULE,
          path: `${closureLib1}/closure/goog/collections/sets.js`,
          closureSymbols: ['goog.collections.sets'],
          imports: [],
          language: 'es6',
        },
      ]);
    });
  });
});
