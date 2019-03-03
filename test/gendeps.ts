import assert = require('assert');
import {depGraph} from 'google-closure-deps';
import path from 'path';
import {addDependency, getClosureLibraryDependencies} from '../src/gendeps';

const closureLibraryDir = '/closure-library-test';

describe('gendeps.js', () => {
  describe('addDependency()', () => {
    it('closure module', () => {
      const dep = addDependency(
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
      const dep = addDependency(
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
      const dep = addDependency(
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
      const dep = addDependency(
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
      const closureLib1 = path.resolve(__dirname, 'fixtures', 'closure-lib1');
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
