import Zet from "zet";

export class Node {
  id: string;
  deps: string[];
  children: Set<Node> = new Set();
  ancestors: Set<string> = new Set();

  /**
   * @param id
   * @param deps IDs of the nodes on which this node depends
   */
  constructor(id: string, deps: readonly string[] = []) {
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
  private sortedNodes: Node[] = [];

  constructor(nodes: readonly Node[]) {
    let root: Node | null = null;
    if (nodes.length < 1) {
      throw new Error("The `nodes` is empty");
    }
    // populate idToNode
    nodes.forEach(node => {
      if (this.idToNode.has(node.id)) {
        throw new Error(`Same ID found: ${node.id}`);
      }
      this.idToNode.set(node.id, node);
      if (node.deps.length === 0) {
        if (root) {
          throw new Error(`Many roots found: ${root.id}, ${node.id}`);
        }
        root = node;
      }
      // initialize cache
      this.lcaCache.set(node.id, new Map());
    });
    if (!root) {
      throw new Error("Root not found");
    }
    this.root = root;
    // populate children (inverting deps)
    nodes.forEach(node => {
      node.deps.forEach(dep => {
        this.idToNode.get(dep)!.children.add(node);
      });
    });
    this.populateDepth();
    this.idToNode.forEach(node => {
      node.ancestors = new Set(this.populateAncestors(node));
    });
  }

  private populateDepth() {
    this.getSortedIds().forEach((id, depth) => {
      this.idToDepth.set(id, depth);
    });
  }

  private populateAncestors(node: Node, ancestors: string[] = []): string[] {
    if (ancestors.length > this.idToNode.size) {
      throw new Error(`Circular dependencies found: ${ancestors}`);
    }
    ancestors.push(node.id);
    node.deps.forEach(dep => {
      this.populateAncestors(this.idToNode.get(dep)!, ancestors);
    });
    return ancestors;
  }

  private getLcaCache(u: string, v: string): Node | undefined {
    if (u > v) {
      [u, v] = [v, u];
    }
    const cache = this.lcaCache.get(u);
    if (!cache) {
      return undefined;
    }
    return cache.get(v);
  }

  private setLcaCache(u: string, v: string, result: Node) {
    if (u > v) {
      [u, v] = [v, u];
    }
    const cache = this.lcaCache.get(u);
    if (!cache) {
      throw new Error(`Node cache not found: ${u}`);
    }
    cache.set(v, result);
  }

  /**
   * @param nodeIds Specify one node at least.
   * @return One of LCAs (Least Common Ancestors) of the nodes.
   * In general, LCA of DAG is not unique.
   */
  getLcaNode(...nodeIds: readonly string[]): Node {
    if (nodeIds.length < 1) {
      throw new Error("Specify one node at least");
    } else if (nodeIds.length < 2) {
      const lca = this.idToNode.get(nodeIds[0]);
      if (!lca) {
        throw new Error(`Node not found: ${nodeIds[0]}`);
      }
      return lca;
    } else if (nodeIds.length < 3) {
      return this.getLcaPair(nodeIds[0], nodeIds[1]);
    } else {
      const lcaId = nodeIds.reduce((prev, cur) => {
        return this.getLcaPair(prev, cur).id;
      });
      const lca = this.idToNode.get(lcaId);
      if (!lca) {
        throw new Error(`Node not found: ${lcaId}`);
      }
      return lca;
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
      throw new Error("Common ancestor not found");
    }
    let least: string | null = null;
    for (const ancestor of commonAncestors) {
      if (least === null || this.idToDepth.get(least)! < this.idToDepth.get(ancestor)!) {
        least = ancestor;
      }
    }
    if (!least) {
      throw new Error("LCA not found");
    }
    result = this.idToNode.get(least)!;
    this.setLcaCache(u, v, result);
    return result;
  }

  /**
   * @return Topological ordred node list.
   * The result is cached and returned from the second time.
   */
  getSortedNodes(): Node[] {
    if (this.sortedNodes.length > 0) {
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

  /**
   * @return Topological ordred id list.
   * The result is cached and returned from the second time.
   */
  getSortedIds(): string[] {
    return this.getSortedNodes().map(node => node.id);
  }
}
