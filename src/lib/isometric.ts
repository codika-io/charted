/**
 * Shared isometric projection primitives.
 *
 * Used by RadialMap (radial/concentric knowledge graphs).
 */

import React from 'react';

// ─── Isometric projection ───

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/** Project a 2D point (x, y) onto the isometric plane. */
export function toIso(x: number, y: number): [number, number] {
  const isoX = (x - y) * COS30;
  const isoY = (x + y) * SIN30;
  return [isoX, isoY];
}

// ─── Polar / Cartesian helpers ───

/** Convert polar coordinates to cartesian. */
export function polarToCartesian(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

/**
 * Generate an SVG path `d` string for an ellipse that results from
 * projecting a circle of the given radius through the isometric transform.
 *
 * Samples `segments` points around the circle, projects each through
 * `toIso`, and connects them with line segments.
 */
export function isometricEllipsePath(
  radius: number,
  cx: number,
  cy: number,
  segments = 64,
): string {
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const [ix, iy] = toIso(x, y);
    pts.push(`${cx + ix},${cy + iy}`);
  }
  return `M${pts[0]} ${pts.slice(1).map(p => `L${p}`).join(' ')} Z`;
}

// ─── Isometric 3D block ───

interface IsometricBlockProps {
  cx: number;
  cy: number;
  size: number;
  color: string;
  opacity?: number;
}

/** Renders an isometric 3D block (cube/pillar) as three SVG polygons. */
export function IsometricBlock({ cx, cy, size, color, opacity = 1 }: IsometricBlockProps) {
  const h = size * 0.6;
  const w = size;

  // Top face
  const top = `${cx},${cy - h} ${cx + w / 2},${cy - h + w / 4} ${cx},${cy - h + w / 2} ${cx - w / 2},${cy - h + w / 4}`;
  // Right face
  const right = `${cx},${cy - h + w / 2} ${cx + w / 2},${cy - h + w / 4} ${cx + w / 2},${cy + w / 4} ${cx},${cy + w / 2}`;
  // Left face
  const left = `${cx},${cy - h + w / 2} ${cx - w / 2},${cy - h + w / 4} ${cx - w / 2},${cy + w / 4} ${cx},${cy + w / 2}`;

  return React.createElement('g', { opacity }, [
    React.createElement('polygon', { key: 'l', points: left, fill: color, opacity: 0.7 }),
    React.createElement('polygon', { key: 'r', points: right, fill: color, opacity: 0.5 }),
    React.createElement('polygon', { key: 't', points: top, fill: color, opacity: 0.9 }),
    // Stroke overlays for edge definition
    React.createElement('polygon', { key: 'ts', points: top, fill: 'none', stroke: color, strokeWidth: 1.5, opacity: 0.9 }),
    React.createElement('polygon', { key: 'rs', points: right, fill: 'none', stroke: color, strokeWidth: 1, opacity: 0.6 }),
    React.createElement('polygon', { key: 'ls', points: left, fill: 'none', stroke: color, strokeWidth: 1, opacity: 0.6 }),
  ]);
}
