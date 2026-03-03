/**
 * Data definitions for the Physics Radial Knowledge Map.
 *
 * 26 nodes arranged in 5 concentric rings (center → frontiers),
 * with ~35 cross-ring edges showing conceptual relationships.
 */

import type { RadialNode, RadialEdge, RingDef } from './radial-types';

// ─── Ring definitions ───

export const PHYSICS_RINGS: RingDef[] = [
  { index: 0, label: '', radius: 0 },
  { index: 1, label: 'Classical', radius: 120 },
  { index: 2, label: 'Quantum & Statistical', radius: 220 },
  { index: 3, label: 'Fields & Matter', radius: 320 },
  { index: 4, label: 'Frontiers', radius: 440 },
];

// ─── Angular offsets per ring ───

const RING_OFFSETS = [0, 0, 20, 12, 8];

// ─── Helper: distribute N nodes evenly around a ring with offset ───

function distributeAngles(count: number, ringIndex: number): number[] {
  const offset = RING_OFFSETS[ringIndex] || 0;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => offset + i * step);
}

// ─── Nodes ───

// Ring 0: Center (1 node)
const centerNode: RadialNode = {
  id: 'physics',
  label: 'Physics',
  slug: 'physics',
  ring: 0,
  angleDeg: 0,
  size: 48,
};

// Ring 1: Classical (5 nodes)
const ring1Ids = [
  { id: 'classical-mechanics', label: 'Mechanics', slug: 'physics/classical-physics/classical-mechanics' },
  { id: 'electromagnetism', label: 'Electromagnetism', slug: 'physics/classical-physics/electromagnetism' },
  { id: 'thermodynamics', label: 'Thermodynamics', slug: 'physics/classical-physics/thermodynamics' },
  { id: 'optics-and-photonics', label: 'Optics', slug: 'physics/classical-physics/optics-and-photonics' },
  { id: 'special-relativity', label: 'Special Rel.', slug: 'physics/modern-and-quantum/special-relativity' },
];
const ring1Angles = distributeAngles(5, 1);
const ring1Nodes: RadialNode[] = ring1Ids.map((n, i) => ({
  ...n,
  ring: 1,
  angleDeg: ring1Angles[i],
  size: 26 + (i % 2 === 0 ? 2 : 0),
}));

// Ring 2: Quantum & Statistical (7 nodes)
const ring2Ids = [
  { id: 'statistical-mechanics', label: 'Stat. Mechanics', slug: 'physics/classical-physics/statistical-mechanics' },
  { id: 'quantum-mechanics', label: 'Quantum Mech.', slug: 'physics/modern-and-quantum/quantum-mechanics' },
  { id: 'general-relativity', label: 'General Rel.', slug: 'physics/modern-and-quantum/general-relativity' },
  { id: 'fluid-dynamics', label: 'Fluid Dynamics', slug: 'physics/classical-physics/fluid-dynamics' },
  { id: 'acoustics-and-wave-phenomena', label: 'Acoustics', slug: 'physics/classical-physics/acoustics-and-wave-phenomena' },
  { id: 'atomic-molecular-optical', label: 'AMO Physics', slug: 'physics/atoms-and-matter/atomic-molecular-optical-physics' },
  { id: 'computational-physics', label: 'Computational', slug: 'physics/applied-and-computational/computational-physics' },
];
const ring2Angles = distributeAngles(7, 2);
const ring2Nodes: RadialNode[] = ring2Ids.map((n, i) => ({
  ...n,
  ring: 2,
  angleDeg: ring2Angles[i],
  size: 22 + (i % 2 === 0 ? 2 : 0),
}));

// Ring 3: Fields & Matter (7 nodes)
const ring3Ids = [
  { id: 'quantum-field-theory', label: 'QFT', slug: 'physics/modern-and-quantum/quantum-field-theory' },
  { id: 'particle-physics', label: 'Particle', slug: 'physics/subatomic/particle-physics' },
  { id: 'nuclear-physics', label: 'Nuclear', slug: 'physics/subatomic/nuclear-physics' },
  { id: 'condensed-matter', label: 'Condensed Matter', slug: 'physics/atoms-and-matter/condensed-matter-physics' },
  { id: 'plasma-physics', label: 'Plasma', slug: 'physics/atoms-and-matter/plasma-physics' },
  { id: 'math-methods', label: 'Math Methods', slug: 'physics/applied-and-computational/mathematical-methods-of-physics' },
  { id: 'nonlinear-dynamics', label: 'Nonlinear Dyn.', slug: 'physics/applied-and-computational/nonlinear-dynamics-and-complex-systems' },
];
const ring3Angles = distributeAngles(7, 3);
const ring3Nodes: RadialNode[] = ring3Ids.map((n, i) => ({
  ...n,
  ring: 3,
  angleDeg: ring3Angles[i],
  size: 22 + (i % 2 === 0 ? 2 : 0),
}));

// Ring 4: Frontiers (6 nodes)
const ring4Ids = [
  { id: 'astrophysics', label: 'Astrophysics', slug: 'physics/astrophysical/astrophysics' },
  { id: 'cosmology', label: 'Cosmology', slug: 'physics/astrophysical/cosmology' },
  { id: 'geophysics', label: 'Geophysics', slug: 'physics/astrophysical/geophysics-and-planetary-science' },
  { id: 'soft-matter', label: 'Soft Matter', slug: 'physics/atoms-and-matter/soft-matter-and-biophysics' },
  { id: 'string-theory', label: 'String Theory', slug: 'physics/frontier/string-theory-and-quantum-gravity' },
  { id: 'quantum-info', label: 'Quantum Info', slug: 'physics/frontier/quantum-information-and-computing' },
];
const ring4Angles = distributeAngles(6, 4);
const ring4Nodes: RadialNode[] = ring4Ids.map((n, i) => ({
  ...n,
  ring: 4,
  angleDeg: ring4Angles[i],
  size: 20 + (i % 2 === 0 ? 2 : 0),
}));

export const PHYSICS_RADIAL_NODES: RadialNode[] = [
  centerNode,
  ...ring1Nodes,
  ...ring2Nodes,
  ...ring3Nodes,
  ...ring4Nodes,
];

// ─── Edges ───

export const PHYSICS_RADIAL_EDGES: RadialEdge[] = [
  // Center → Classical (hub spokes)
  { source: 'physics', target: 'classical-mechanics' },
  { source: 'physics', target: 'electromagnetism' },
  { source: 'physics', target: 'thermodynamics' },
  { source: 'physics', target: 'optics-and-photonics' },
  { source: 'physics', target: 'special-relativity' },

  // Ring 1 → Ring 2
  { source: 'thermodynamics', target: 'statistical-mechanics' },
  { source: 'classical-mechanics', target: 'fluid-dynamics' },
  { source: 'electromagnetism', target: 'optics-and-photonics' },
  { source: 'optics-and-photonics', target: 'acoustics-and-wave-phenomena' },
  { source: 'electromagnetism', target: 'quantum-mechanics' },
  { source: 'special-relativity', target: 'general-relativity' },
  { source: 'special-relativity', target: 'quantum-mechanics' },
  { source: 'optics-and-photonics', target: 'atomic-molecular-optical' },
  { source: 'classical-mechanics', target: 'computational-physics' },

  // Ring 2 → Ring 3
  { source: 'quantum-mechanics', target: 'quantum-field-theory' },
  { source: 'quantum-mechanics', target: 'particle-physics' },
  { source: 'quantum-mechanics', target: 'nuclear-physics' },
  { source: 'statistical-mechanics', target: 'condensed-matter' },
  { source: 'fluid-dynamics', target: 'plasma-physics' },
  { source: 'computational-physics', target: 'math-methods' },
  { source: 'fluid-dynamics', target: 'nonlinear-dynamics' },
  { source: 'atomic-molecular-optical', target: 'condensed-matter' },

  // Ring 3 → Ring 4
  { source: 'quantum-field-theory', target: 'string-theory' },
  { source: 'general-relativity', target: 'astrophysics' },
  { source: 'general-relativity', target: 'cosmology' },
  { source: 'particle-physics', target: 'cosmology' },
  { source: 'nuclear-physics', target: 'astrophysics' },
  { source: 'condensed-matter', target: 'soft-matter' },
  { source: 'nonlinear-dynamics', target: 'geophysics' },
  { source: 'quantum-mechanics', target: 'quantum-info' },
  { source: 'quantum-field-theory', target: 'particle-physics' },

  // Cross-ring connections
  { source: 'astrophysics', target: 'cosmology' },
  { source: 'string-theory', target: 'cosmology' },
  { source: 'plasma-physics', target: 'astrophysics' },
  { source: 'string-theory', target: 'quantum-info' },
  { source: 'math-methods', target: 'quantum-field-theory' },
  { source: 'electromagnetism', target: 'plasma-physics' },
];
