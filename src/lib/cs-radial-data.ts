/**
 * Data definitions for the CS Radial Knowledge Map.
 *
 * 29 nodes arranged in 5 concentric rings (center → applications),
 * with ~35 cross-ring edges showing conceptual relationships.
 */

import type { RadialNode, RadialEdge, RingDef } from './radial-types';

// ─── Ring definitions ───

export const CS_RINGS: RingDef[] = [
  { index: 0, label: '', radius: 0 },
  { index: 1, label: 'Foundations', radius: 120 },
  { index: 2, label: 'Languages & Methods', radius: 220 },
  { index: 3, label: 'Systems', radius: 320 },
  { index: 4, label: 'Applications', radius: 440 },
];

// ─── Angular offsets per ring (prevents radial alignment across rings) ───

const RING_OFFSETS = [0, 0, 25, 15, 8];

// ─── Helper: distribute N nodes evenly around a ring with offset ───

function distributeAngles(count: number, ringIndex: number): number[] {
  const offset = RING_OFFSETS[ringIndex] || 0;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => offset + i * step);
}

// ─── Nodes ───

// Ring 0: Center (1 node)
const centerNode: RadialNode = {
  id: 'cs',
  label: 'Computer Science',
  slug: 'computer-science',
  ring: 0,
  angleDeg: 0,
  size: 48,
};

// Ring 1: Foundations (5 nodes)
const foundationIds = [
  { id: 'discrete-math', label: 'Discrete Math', slug: 'computer-science/theoretical-foundations/discrete-mathematics' },
  { id: 'theory-of-computation', label: 'Computation', slug: 'computer-science/theoretical-foundations/theory-of-computation' },
  { id: 'information-theory', label: 'Info Theory', slug: 'computer-science/theoretical-foundations/information-theory' },
  { id: 'algorithms', label: 'Algorithms', slug: 'computer-science/theoretical-foundations/algorithms-and-complexity' },
  { id: 'data-structures', label: 'Data Structures', slug: 'computer-science/theoretical-foundations/data-structures' },
];
const foundationAngles = distributeAngles(5, 1);
const foundationNodes: RadialNode[] = foundationIds.map((n, i) => ({
  ...n,
  ring: 1,
  angleDeg: foundationAngles[i],
  size: 26 + (i % 2 === 0 ? 2 : 0), // 26-28
}));

// Ring 2: Languages & Methods (4 nodes)
const langIds = [
  { id: 'programming-languages', label: 'Languages', slug: 'computer-science/programming-and-languages/programming-languages' },
  { id: 'compilers', label: 'Compilers', slug: 'computer-science/programming-and-languages/compilers-and-interpreters' },
  { id: 'software-engineering', label: 'Software Eng.', slug: 'computer-science/programming-and-languages/software-engineering' },
  { id: 'formal-methods', label: 'Formal Methods', slug: 'computer-science/programming-and-languages/formal-methods' },
];
const langAngles = distributeAngles(4, 2);
const langNodes: RadialNode[] = langIds.map((n, i) => ({
  ...n,
  ring: 2,
  angleDeg: langAngles[i],
  size: 24 + (i % 2 === 0 ? 2 : 0), // 24-26
}));

// Ring 3: Systems (6 nodes)
const systemIds = [
  { id: 'architecture', label: 'Architecture', slug: 'computer-science/systems/computer-architecture' },
  { id: 'operating-systems', label: 'OS', slug: 'computer-science/systems/operating-systems' },
  { id: 'networks', label: 'Networks', slug: 'computer-science/systems/computer-networks' },
  { id: 'distributed-systems', label: 'Distributed', slug: 'computer-science/systems/distributed-systems' },
  { id: 'security', label: 'Security', slug: 'computer-science/systems/cybersecurity' },
  { id: 'parallel-computing', label: 'Parallel', slug: 'computer-science/systems/parallel-computing' },
];
const systemAngles = distributeAngles(6, 3);
const systemNodes: RadialNode[] = systemIds.map((n, i) => ({
  ...n,
  ring: 3,
  angleDeg: systemAngles[i],
  size: 24 + (i % 2 === 0 ? 2 : 0), // 24-26
}));

// Ring 4: Applications (13 nodes)
const appIds = [
  { id: 'ai', label: 'AI', slug: 'computer-science/ai-and-machine-learning/artificial-intelligence' },
  { id: 'ml', label: 'ML', slug: 'computer-science/ai-and-machine-learning/machine-learning' },
  { id: 'nlp', label: 'NLP', slug: 'computer-science/ai-and-machine-learning/natural-language-processing' },
  { id: 'robotics', label: 'Robotics', slug: 'computer-science/ai-and-machine-learning/robotics' },
  { id: 'graphics', label: 'Graphics', slug: 'computer-science/graphics-and-vision/computer-graphics' },
  { id: 'vision', label: 'Vision', slug: 'computer-science/graphics-and-vision/computer-vision' },
  { id: 'hci', label: 'HCI', slug: 'computer-science/graphics-and-vision/human-computer-interaction' },
  { id: 'databases', label: 'Databases', slug: 'computer-science/data-and-information/databases' },
  { id: 'info-retrieval', label: 'Info Retrieval', slug: 'computer-science/data-and-information/information-retrieval' },
  { id: 'data-science', label: 'Data Science', slug: 'computer-science/data-and-information/data-science' },
  { id: 'cryptography', label: 'Cryptography', slug: 'computer-science/applied-and-interdisciplinary/cryptography' },
  { id: 'quantum-computing', label: 'Quantum', slug: 'computer-science/applied-and-interdisciplinary/quantum-computing' },
  { id: 'bioinformatics', label: 'Bioinformatics', slug: 'computer-science/applied-and-interdisciplinary/bioinformatics' },
];
const appAngles = distributeAngles(13, 4);
const appNodes: RadialNode[] = appIds.map((n, i) => ({
  ...n,
  ring: 4,
  angleDeg: appAngles[i],
  size: 20 + (i % 3 === 0 ? 4 : i % 3 === 1 ? 2 : 0), // 20-24
}));

export const CS_RADIAL_NODES: RadialNode[] = [
  centerNode,
  ...foundationNodes,
  ...langNodes,
  ...systemNodes,
  ...appNodes,
];

// ─── Edges ───

export const CS_RADIAL_EDGES: RadialEdge[] = [
  // Center → Foundations (hub spokes)
  { source: 'cs', target: 'discrete-math' },
  { source: 'cs', target: 'theory-of-computation' },
  { source: 'cs', target: 'information-theory' },
  { source: 'cs', target: 'algorithms' },
  { source: 'cs', target: 'data-structures' },

  // Foundations → Languages & Methods
  { source: 'theory-of-computation', target: 'compilers' },
  { source: 'theory-of-computation', target: 'formal-methods' },
  { source: 'algorithms', target: 'software-engineering' },
  { source: 'data-structures', target: 'programming-languages' },
  { source: 'information-theory', target: 'compilers' },

  // Foundations → Applications (cross-ring)
  { source: 'algorithms', target: 'ml' },
  { source: 'algorithms', target: 'cryptography' },
  { source: 'information-theory', target: 'nlp' },

  // Languages & Methods → Systems
  { source: 'programming-languages', target: 'operating-systems' },
  { source: 'programming-languages', target: 'parallel-computing' },
  { source: 'compilers', target: 'architecture' },
  { source: 'software-engineering', target: 'distributed-systems' },
  { source: 'formal-methods', target: 'security' },

  // Systems → Applications
  { source: 'distributed-systems', target: 'databases' },
  { source: 'networks', target: 'security' },
  { source: 'architecture', target: 'parallel-computing' },

  // Within Ring 4: AI cluster
  { source: 'ai', target: 'ml' },
  { source: 'ml', target: 'nlp' },
  { source: 'ai', target: 'robotics' },

  // Within Ring 4: Graphics cluster
  { source: 'graphics', target: 'vision' },
  { source: 'vision', target: 'hci' },
  { source: 'graphics', target: 'hci' },

  // Within Ring 4: Data cluster
  { source: 'databases', target: 'info-retrieval' },
  { source: 'info-retrieval', target: 'data-science' },
  { source: 'databases', target: 'data-science' },

  // Within Ring 4: Applied cluster
  { source: 'cryptography', target: 'quantum-computing' },
  { source: 'quantum-computing', target: 'bioinformatics' },

  // Cross-cluster in Ring 4
  { source: 'ml', target: 'data-science' },
  { source: 'ml', target: 'vision' },
  { source: 'nlp', target: 'info-retrieval' },
  { source: 'robotics', target: 'vision' },
];
