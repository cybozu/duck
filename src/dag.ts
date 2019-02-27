import Zet from 'zet';

export class Node {
  id: string;
  deps: string[];
  children: Set<Node> = new Set();
  ancestors: Set<string> = new Set();

  /**
   * @param id
   * @param deps IDs of the nodes on which this node depends
   */
  constructor(id: string, deps: string[] = []) {
    this.id = id;
    this.deps = deps.slice();
  }
}

/**
 * DAG (Directed Acyclic Graph) to calculate topological ordred nodes and LCA.
 */
export class Dag {
  private idToDepth: Map<string, number> = new Map();
  private idToNode: Map<string, Node> = new Map();
  private root: Node;
  private lcaCache: Map<string, Map<string, Node>> = new Map();
  private sortedNodes: Node[];

  constructor(nodes: Node[]) {
    // populate idToNode
    nodes.forEach(node => {
      if (this.idToNode.has(node.id)) {
        throw new Error(`Same ID found: ${node.id}`);
      }
      this.idToNode.set(node.id, node);
      if (node.deps.length === 0) {
        if (this.root) {
          throw new Error(`Many roots found: ${this.root.id}, ${node.id}`);
        }
        this.root = node;
      }
      // initialize cache
      this.lcaCache.set(node.id, new Map());
    });
    if (!this.root) {
      throw new Error('Root not found');
    }
    // populate children (inverting deps)
    nodes.forEach(node => {
      node.deps.forEach(dep => {
        this.idToNode.get(dep).children.add(node);
      });
    });
    this.populateDepth();
    this.idToNode.forEach(node => {
      this.populateAncestors(node);
    });
  }

  private populateDepth() {
    this.getSortedNodes().forEach((node, depth) => {
      this.idToDepth.set(node.id, depth);
    });
  }

  private populateAncestors(node: Node, ancestors = node.ancestors) {
    ancestors.add(node.id);
    node.deps.forEach(dep => {
      ancestors.add(dep);
      this.populateAncestors(this.idToNode.get(dep), ancestors);
    });
  }

  private getLcaCache(u: string, v: string): Node {
    if (u > v) {
      [u, v] = [v, u];
    }
    return this.lcaCache.get(u).get(v);
  }

  private setLcaCache(u: string, v: string, result: Node) {
    if (u > v) {
      [u, v] = [v, u];
    }
    this.lcaCache.get(u).set(v, result);
  }

  /**
   * @param nodes Specify one node at least.
   * @return One of LCAs (Least Common Ancestors) of the nodes.
   * In general, LCA of DAG is not unique.
   */
  getLcaNode(...nodes: string[]): Node {
    if (nodes.length < 1) {
      throw new Error('Specify one node at least');
    } else if (nodes.length < 2) {
      return this.idToNode.get(nodes[0]);
    } else if (nodes.length < 3) {
      return this.getLcaPair(nodes[0], nodes[1]);
    } else {
      const lcaId = nodes.reduce((prev, cur) => {
        return this.getLcaPair(prev, cur).id;
      });
      return this.idToNode.get(lcaId);
    }
  }

  private getLcaPair(u: string, v: string): Node {
    let result = this.getLcaCache(u, v);
    if (result) {
      return result;
    }
    const nodeU = this.idToNode.get(u);
    if (!nodeU) {
      throw new Error(`Node not found: ${u}`);
    }
    const nodeV = this.idToNode.get(v);
    if (!nodeV) {
      throw new Error(`Node not found: ${v}`);
    }
    const commonAncestors = Zet.intersection(nodeU.ancestors, nodeV.ancestors);
    if (commonAncestors.size < 1) {
      throw new Error('Common ancestor not found');
    }
    let least: string | null = null;
    for (const ancestor of commonAncestors) {
      if (least === null || this.idToDepth.get(least) < this.idToDepth.get(ancestor)) {
        least = ancestor;
      }
    }
    result = this.idToNode.get(least);
    this.setLcaCache(u, v, result);
    return result;
  }

  /**
   * @return Topological ordred node list.
   * The result is cached and returned from the second time.
   */
  getSortedNodes(): Node[] {
    if (this.sortedNodes) {
      return this.sortedNodes;
    }
    const visited: Set<Node> = new Set();
    this.sortedNodes = [];
    const visit = (node: Node) => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      node.children.forEach(visit);
      this.sortedNodes.unshift(node);
    };
    visit(this.root);
    return this.sortedNodes;
  }
}
