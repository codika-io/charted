import graphData from '../generated/graph.json';

export type GraphNode = {
  id: string;
  title: string;
  description: string;
  parent?: string;
  color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'stub' | 'draft' | 'review' | 'complete' | 'archived';
  tier: 'foundation' | 'field' | 'frontier';
  sourcesCount: number;
  prerequisites: string[];
  reviewIssue?: number;
  lastEditedBy?: string;
  reviewerHandles: string[];
  ancestors: string[];
  descendants: string[];
  depth: number;
  /** Precomputed layout coordinates (relative to layout.width/height). */
  x?: number;
  y?: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: 'prerequisite';
};

export type Reviewer = {
  github: string;
  orcid?: string | null;
  name?: string;
  expertise: string[];
  tier: 'foundation' | 'field' | 'frontier';
  verifiedBy?: string;
  verifiedAt?: string;
};

export type GraphPayload = {
  generatedAt: string;
  layout?: { width: number; height: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
  reviewers: Reviewer[];
};

export const graph: GraphPayload = graphData as GraphPayload;

export function getNode(id: string): GraphNode | undefined {
  return graph.nodes.find(n => n.id === id);
}

/** Subgraph: a node plus its full ancestor and descendant closures. */
export function neighborhood(id: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const node = getNode(id);
  if (!node) return { nodes: [], edges: [] };
  const keep = new Set<string>([id, ...node.ancestors, ...node.descendants]);
  return {
    nodes: graph.nodes.filter(n => keep.has(n.id)),
    edges: graph.edges.filter(e => keep.has(e.from) && keep.has(e.to)),
  };
}
