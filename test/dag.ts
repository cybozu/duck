import assert = require('assert');
import {Dag, Node} from '../src/dag';

describe('Dag', () => {
  describe('constructor', () => {
    it('no root', () => {
      assert.throws(() => {
        new Dag([]);
      }, /Root not found/);
    });
    it('many roots', () => {
      const a = new Node('a');
      const b = new Node('b');
      assert.throws(() => {
        new Dag([a, b]);
      }, /Many roots found: a, b/);
    });
    it('same nodes', () => {
      const a = new Node('a');
      const a2 = new Node('a');
      assert.throws(() => {
        new Dag([a, a2]);
      }, /Same ID found: a/);
    });
    it('calc children', () => {
      const a = new Node('a');
      const b = new Node('b', ['a']);
      assert(a.children.size === 0);
      assert(b.children.size === 0);
      new Dag([a, b]);
      assert.deepEqual(Array.from(a.children.values()), [b]);
      assert(b.children.size === 0);
    });
  });
  describe('lca', () => {
    it('simple', () => {
      //      c
      //     /
      // -> a-b-d
      const dag = new Dag([
        new Node('a', []),
        new Node('b', ['a']),
        new Node('c', ['a']),
        new Node('d', ['b']),
      ]);
      assert(dag.getLcaNode('a', 'b').id === 'a');
      assert(dag.getLcaNode('b', 'c').id === 'a');
      assert(dag.getLcaNode('c', 'a').id === 'a');
      assert(dag.getLcaNode('a', 'd').id === 'a');
      assert(dag.getLcaNode('b', 'd').id === 'b');
      assert(dag.getLcaNode('c', 'd').id === 'a');
    });

    it('acyclic', () => {
      //      c
      //     / \
      // -> a - b
      const dag = new Dag([new Node('a', []), new Node('b', ['a', 'c']), new Node('c', ['a'])]);
      assert(dag.getLcaNode('a', 'b').id === 'a');
      assert(dag.getLcaNode('a', 'c').id === 'a');
      assert(dag.getLcaNode('b', 'c').id === 'c');
    });

    it('asyclic 2', () => {
      //      c-d
      //     /  |
      // -> a-b-e
      const dag = new Dag([
        new Node('a', []),
        new Node('b', ['a']),
        new Node('c', ['a']),
        new Node('d', ['c']),
        new Node('e', ['b', 'd']),
      ]);
      assert(dag.getLcaNode('a', 'b').id === 'a');
      assert(dag.getLcaNode('b', 'c').id === 'a');
      assert(dag.getLcaNode('b', 'd').id === 'a');
      assert(dag.getLcaNode('b', 'e').id === 'b');
      assert(dag.getLcaNode('c', 'd').id === 'c');
      assert(dag.getLcaNode('d', 'e').id === 'd');
    });

    it('query 3 nodes', () => {
      //      c   e
      //     /   /
      // -> a - b - d
      const dag = new Dag([
        new Node('a', []),
        new Node('b', ['a']),
        new Node('c', ['a']),
        new Node('d', ['b']),
        new Node('e', ['b']),
      ]);
      assert(dag.getLcaNode('a', 'b', 'c').id === 'a');
      assert(dag.getLcaNode('a', 'b', 'd').id === 'a');
      assert(dag.getLcaNode('d', 'b', 'e').id === 'b');
      assert(dag.getLcaNode('d', 'c', 'e').id === 'a');
    });
  });
});
