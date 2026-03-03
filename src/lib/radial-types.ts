/**
 * Shared type definitions for radial knowledge maps.
 */

export interface RadialNode {
  id: string;
  label: string;
  slug: string;
  ring: number;       // 0 = center, 1+ = outer rings
  angleDeg: number;   // polar angle within ring (degrees)
  size: number;       // block size in px
}

export interface RadialEdge {
  source: string;
  target: string;
}

export interface RingDef {
  index: number;
  label: string;
  radius: number;
}
