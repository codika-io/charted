/**
 * Data definitions for the Mathematics Radial Knowledge Map.
 *
 * 62 nodes arranged in 6 concentric rings (center → frontier),
 * with ~55 cross-ring edges showing conceptual relationships.
 */

import type { RadialNode, RadialEdge, RingDef } from './radial-types';

// ─── Ring definitions ───

export const MATH_RINGS: RingDef[] = [
  { index: 0, label: '', radius: 0 },
  { index: 1, label: 'Foundations', radius: 100 },
  { index: 2, label: 'Core Theory', radius: 185 },
  { index: 3, label: 'Structural', radius: 265 },
  { index: 4, label: 'Advanced', radius: 350 },
  { index: 5, label: 'Frontier', radius: 450 },
];

// ─── Angular offsets per ring ───

const RING_OFFSETS = [0, 0, 12, 8, 5, 3];

// ─── Helper: distribute N nodes evenly around a ring with offset ───

function distributeAngles(count: number, ringIndex: number): number[] {
  const offset = RING_OFFSETS[ringIndex] || 0;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => offset + i * step);
}

// ─── Nodes ───

// Ring 0: Center (1 node)
const centerNode: RadialNode = {
  id: 'math',
  label: 'Mathematics',
  slug: 'mathematics',
  ring: 0,
  angleDeg: 0,
  size: 48,
};

// Ring 1: Foundations (6 nodes)
const ring1Ids = [
  { id: 'propositional-logic', label: 'Prop. Logic', slug: 'mathematics/logic/propositional-logic' },
  { id: 'naive-set-theory', label: 'Naive Sets', slug: 'mathematics/set-theory/naive-set-theory' },
  { id: 'elementary-number-theory', label: 'Elem. Numbers', slug: 'mathematics/number-theory/elementary-number-theory' },
  { id: 'linear-algebra', label: 'Linear Algebra', slug: 'mathematics/algebra/linear-algebra' },
  { id: 'real-analysis', label: 'Real Analysis', slug: 'mathematics/analysis/real-analysis' },
  { id: 'probability-theory', label: 'Probability', slug: 'mathematics/probability/probability-theory' },
];
const ring1Angles = distributeAngles(6, 1);
const ring1Nodes: RadialNode[] = ring1Ids.map((n, i) => ({
  ...n,
  ring: 1,
  angleDeg: ring1Angles[i],
  size: 26 + (i % 2 === 0 ? 2 : 0),
}));

// Ring 2: Core Theory (10 nodes)
const ring2Ids = [
  { id: 'first-order-logic', label: 'First-Order Logic', slug: 'mathematics/logic/first-order-logic' },
  { id: 'proof-theory', label: 'Proof Theory', slug: 'mathematics/logic/proof-theory' },
  { id: 'zfc-axioms', label: 'ZFC Axioms', slug: 'mathematics/set-theory/zfc-axioms' },
  { id: 'ordinals-and-cardinals', label: 'Ordinals', slug: 'mathematics/set-theory/ordinals-and-cardinals' },
  { id: 'algebraic-number-theory', label: 'Alg. Number Th.', slug: 'mathematics/number-theory/algebraic-number-theory' },
  { id: 'abstract-algebra', label: 'Abstract Algebra', slug: 'mathematics/algebra/abstract-algebra' },
  { id: 'complex-analysis', label: 'Complex Analysis', slug: 'mathematics/analysis/complex-analysis' },
  { id: 'measure-theory', label: 'Measure Theory', slug: 'mathematics/analysis/measure-theory' },
  { id: 'enumerative-combinatorics', label: 'Enumeration', slug: 'mathematics/combinatorics/enumerative-combinatorics' },
  { id: 'mathematical-statistics', label: 'Statistics', slug: 'mathematics/probability/mathematical-statistics' },
];
const ring2Angles = distributeAngles(10, 2);
const ring2Nodes: RadialNode[] = ring2Ids.map((n, i) => ({
  ...n,
  ring: 2,
  angleDeg: ring2Angles[i],
  size: 22 + (i % 2 === 0 ? 2 : 0),
}));

// Ring 3: Structural (14 nodes)
const ring3Ids = [
  { id: 'model-theory', label: 'Model Theory', slug: 'mathematics/logic/model-theory' },
  { id: 'computability-theory', label: 'Computability', slug: 'mathematics/logic/computability-theory' },
  { id: 'proof-systems', label: 'Proof Systems', slug: 'mathematics/logic/proof-systems' },
  { id: 'axiom-of-choice', label: 'Axiom of Choice', slug: 'mathematics/set-theory/axiom-of-choice' },
  { id: 'functions-and-cardinality', label: 'Cardinality', slug: 'mathematics/set-theory/functions-and-cardinality' },
  { id: 'analytic-number-theory', label: 'Analytic NT', slug: 'mathematics/number-theory/analytic-number-theory' },
  { id: 'commutative-algebra', label: 'Commutative Alg.', slug: 'mathematics/algebra/commutative-algebra' },
  { id: 'euclidean-and-non-euclidean', label: 'Geometry', slug: 'mathematics/geometry/euclidean-and-non-euclidean' },
  { id: 'general-topology', label: 'Gen. Topology', slug: 'mathematics/topology/general-topology' },
  { id: 'functional-analysis', label: 'Functional An.', slug: 'mathematics/analysis/functional-analysis' },
  { id: 'graph-theory', label: 'Graph Theory', slug: 'mathematics/combinatorics/graph-theory' },
  { id: 'numerical-analysis', label: 'Numerical An.', slug: 'mathematics/applied-mathematics/numerical-analysis' },
  { id: 'game-theory', label: 'Game Theory', slug: 'mathematics/applied-mathematics/game-theory' },
  { id: 'ode', label: 'ODE', slug: 'mathematics/analysis/ordinary-differential-equations' },
];
const ring3Angles = distributeAngles(14, 3);
const ring3Nodes: RadialNode[] = ring3Ids.map((n, i) => ({
  ...n,
  ring: 3,
  angleDeg: ring3Angles[i],
  size: 20 + (i % 3 === 0 ? 4 : i % 3 === 1 ? 2 : 0),
}));

// Ring 4: Advanced (16 nodes)
const ring4Ids = [
  { id: 'incompleteness-theorems', label: 'Incompleteness', slug: 'mathematics/logic/incompleteness-theorems' },
  { id: 'type-theory', label: 'Type Theory', slug: 'mathematics/logic/type-theory' },
  { id: 'axiomatic-set-theory', label: 'Axiomatic Sets', slug: 'mathematics/logic/axiomatic-set-theory' },
  { id: 'continuum-hypothesis', label: 'Continuum Hyp.', slug: 'mathematics/set-theory/continuum-hypothesis' },
  { id: 'quadratic-reciprocity', label: 'Reciprocity', slug: 'mathematics/number-theory/quadratic-reciprocity' },
  { id: 'diophantine-equations', label: 'Diophantine', slug: 'mathematics/number-theory/diophantine-equations' },
  { id: 'representation-theory', label: 'Representation', slug: 'mathematics/algebra/representation-theory' },
  { id: 'category-theory', label: 'Category Theory', slug: 'mathematics/algebra/category-theory' },
  { id: 'differential-geometry', label: 'Diff. Geometry', slug: 'mathematics/geometry/differential-geometry' },
  { id: 'algebraic-topology', label: 'Alg. Topology', slug: 'mathematics/topology/algebraic-topology' },
  { id: 'harmonic-analysis', label: 'Harmonic An.', slug: 'mathematics/analysis/harmonic-analysis' },
  { id: 'pde', label: 'PDE', slug: 'mathematics/analysis/partial-differential-equations' },
  { id: 'extremal-combinatorics', label: 'Extremal Comb.', slug: 'mathematics/combinatorics/extremal-combinatorics' },
  { id: 'algebraic-combinatorics', label: 'Alg. Comb.', slug: 'mathematics/combinatorics/algebraic-combinatorics' },
  { id: 'optimization', label: 'Optimization', slug: 'mathematics/applied-mathematics/optimization' },
  { id: 'information-theory', label: 'Info Theory', slug: 'mathematics/applied-mathematics/information-theory' },
];
const ring4Angles = distributeAngles(16, 4);
const ring4Nodes: RadialNode[] = ring4Ids.map((n, i) => ({
  ...n,
  ring: 4,
  angleDeg: ring4Angles[i],
  size: 18 + (i % 3 === 0 ? 4 : i % 3 === 1 ? 2 : 0),
}));

// Ring 5: Frontier (15 nodes)
const ring5Ids = [
  { id: 'forcing', label: 'Forcing', slug: 'mathematics/set-theory/forcing' },
  { id: 'large-cardinals', label: 'Large Cardinals', slug: 'mathematics/set-theory/large-cardinals' },
  { id: 'advanced-set-theory', label: 'Adv. Set Theory', slug: 'mathematics/set-theory/advanced-set-theory' },
  { id: 'elliptic-curves', label: 'Elliptic Curves', slug: 'mathematics/number-theory/elliptic-curves' },
  { id: 'p-adic-analysis', label: 'p-adic', slug: 'mathematics/number-theory/p-adic-analysis' },
  { id: 'langlands-program', label: 'Langlands', slug: 'mathematics/number-theory/langlands-program' },
  { id: 'lie-theory', label: 'Lie Theory', slug: 'mathematics/algebra/lie-theory' },
  { id: 'algebraic-geometry', label: 'Alg. Geometry', slug: 'mathematics/geometry/algebraic-geometry' },
  { id: 'dynamical-systems', label: 'Dynamical Sys.', slug: 'mathematics/analysis/dynamical-systems' },
  { id: 'additive-combinatorics', label: 'Additive Comb.', slug: 'mathematics/combinatorics/additive-combinatorics' },
  { id: 'probabilistic-combinatorics', label: 'Prob. Comb.', slug: 'mathematics/combinatorics/probabilistic-combinatorics' },
  { id: 'combinatorial-designs', label: 'Designs', slug: 'mathematics/combinatorics/combinatorial-designs' },
  { id: 'geometric-combinatorics', label: 'Geom. Comb.', slug: 'mathematics/combinatorics/geometric-combinatorics' },
  { id: 'cryptography', label: 'Cryptography', slug: 'mathematics/applied-mathematics/cryptography' },
  { id: 'mathematical-physics', label: 'Math Physics', slug: 'mathematics/applied-mathematics/mathematical-physics' },
];
const ring5Angles = distributeAngles(15, 5);
const ring5Nodes: RadialNode[] = ring5Ids.map((n, i) => ({
  ...n,
  ring: 5,
  angleDeg: ring5Angles[i],
  size: 16 + (i % 3 === 0 ? 4 : i % 3 === 1 ? 2 : 0),
}));

export const MATH_RADIAL_NODES: RadialNode[] = [
  centerNode,
  ...ring1Nodes,
  ...ring2Nodes,
  ...ring3Nodes,
  ...ring4Nodes,
  ...ring5Nodes,
];

// ─── Edges ───

export const MATH_RADIAL_EDGES: RadialEdge[] = [
  // Center → Foundations (hub spokes)
  { source: 'math', target: 'propositional-logic' },
  { source: 'math', target: 'naive-set-theory' },
  { source: 'math', target: 'elementary-number-theory' },
  { source: 'math', target: 'linear-algebra' },
  { source: 'math', target: 'real-analysis' },
  { source: 'math', target: 'probability-theory' },

  // Ring 1 → Ring 2 (vertical growth within branches)
  { source: 'propositional-logic', target: 'first-order-logic' },
  { source: 'propositional-logic', target: 'proof-theory' },
  { source: 'naive-set-theory', target: 'zfc-axioms' },
  { source: 'naive-set-theory', target: 'ordinals-and-cardinals' },
  { source: 'elementary-number-theory', target: 'algebraic-number-theory' },
  { source: 'linear-algebra', target: 'abstract-algebra' },
  { source: 'real-analysis', target: 'complex-analysis' },
  { source: 'real-analysis', target: 'measure-theory' },
  { source: 'probability-theory', target: 'mathematical-statistics' },

  // Ring 2 → Ring 3
  { source: 'first-order-logic', target: 'model-theory' },
  { source: 'proof-theory', target: 'proof-systems' },
  { source: 'first-order-logic', target: 'computability-theory' },
  { source: 'zfc-axioms', target: 'axiom-of-choice' },
  { source: 'ordinals-and-cardinals', target: 'functions-and-cardinality' },
  { source: 'algebraic-number-theory', target: 'analytic-number-theory' },
  { source: 'abstract-algebra', target: 'commutative-algebra' },
  { source: 'complex-analysis', target: 'functional-analysis' },
  { source: 'measure-theory', target: 'functional-analysis' },
  { source: 'real-analysis', target: 'ode' },
  { source: 'enumerative-combinatorics', target: 'graph-theory' },

  // Ring 3 → Ring 4
  { source: 'model-theory', target: 'incompleteness-theorems' },
  { source: 'computability-theory', target: 'type-theory' },
  { source: 'proof-systems', target: 'axiomatic-set-theory' },
  { source: 'axiom-of-choice', target: 'continuum-hypothesis' },
  { source: 'analytic-number-theory', target: 'quadratic-reciprocity' },
  { source: 'analytic-number-theory', target: 'diophantine-equations' },
  { source: 'commutative-algebra', target: 'representation-theory' },
  { source: 'commutative-algebra', target: 'category-theory' },
  { source: 'euclidean-and-non-euclidean', target: 'differential-geometry' },
  { source: 'general-topology', target: 'algebraic-topology' },
  { source: 'functional-analysis', target: 'harmonic-analysis' },
  { source: 'ode', target: 'pde' },
  { source: 'graph-theory', target: 'extremal-combinatorics' },
  { source: 'graph-theory', target: 'algebraic-combinatorics' },
  { source: 'numerical-analysis', target: 'optimization' },
  { source: 'game-theory', target: 'information-theory' },

  // Ring 4 → Ring 5
  { source: 'continuum-hypothesis', target: 'forcing' },
  { source: 'axiomatic-set-theory', target: 'large-cardinals' },
  { source: 'continuum-hypothesis', target: 'advanced-set-theory' },
  { source: 'diophantine-equations', target: 'elliptic-curves' },
  { source: 'quadratic-reciprocity', target: 'p-adic-analysis' },
  { source: 'algebraic-number-theory', target: 'langlands-program' },
  { source: 'representation-theory', target: 'lie-theory' },
  { source: 'differential-geometry', target: 'algebraic-geometry' },
  { source: 'pde', target: 'dynamical-systems' },
  { source: 'extremal-combinatorics', target: 'additive-combinatorics' },
  { source: 'extremal-combinatorics', target: 'probabilistic-combinatorics' },
  { source: 'algebraic-combinatorics', target: 'combinatorial-designs' },
  { source: 'algebraic-combinatorics', target: 'geometric-combinatorics' },
  { source: 'information-theory', target: 'cryptography' },
  { source: 'optimization', target: 'mathematical-physics' },

  // Cross-branch connections
  { source: 'abstract-algebra', target: 'algebraic-number-theory' },
  { source: 'measure-theory', target: 'probability-theory' },
  { source: 'category-theory', target: 'algebraic-topology' },
  { source: 'lie-theory', target: 'differential-geometry' },
  { source: 'elliptic-curves', target: 'langlands-program' },
  { source: 'algebraic-geometry', target: 'langlands-program' },
  { source: 'lie-theory', target: 'representation-theory' },
  { source: 'harmonic-analysis', target: 'pde' },
  { source: 'mathematical-statistics', target: 'enumerative-combinatorics' },
];
