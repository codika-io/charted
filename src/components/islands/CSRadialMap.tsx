import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { playHoverTick } from '../../lib/hover-sound';
import { toIso, IsometricBlock, polarToCartesian, isometricEllipsePath } from '../../lib/isometric';
import { CS_RADIAL_NODES, CS_RADIAL_EDGES, RINGS, type RadialNode } from '../../lib/cs-radial-data';

const DEFAULT_ACCENT = '#3b82f6'; // CS blue
const DEFAULT_SURFACE = '#d4d4d4';

const VB_W = 1100;
const VB_H = 750;
const CX = VB_W / 2;
const CY = VB_H / 2 - 20; // shift up slightly so labels at bottom have room

/** Compute the isometric screen position for a radial node. */
function nodePosition(node: RadialNode): [number, number] {
  if (node.ring === 0) return [CX, CY];
  const ring = RINGS[node.ring];
  const [px, py] = polarToCartesian(ring.radius, node.angleDeg);
  const [ix, iy] = toIso(px, py);
  return [CX + ix, CY + iy];
}

export default function CSRadialMap() {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [colors, setColors] = useState({ accent: DEFAULT_ACCENT, surface: DEFAULT_SURFACE });
  const lastSoundNodeRef = useRef<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dotGridId = `radialDotGrid${uid}`;
  const glowId = `radialGlow${uid}`;

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const styles = getComputedStyle(el);
      setColors({
        accent: styles.getPropertyValue('--color-accent-500').trim() || DEFAULT_ACCENT,
        surface: styles.getPropertyValue('--color-surface-300').trim() || DEFAULT_SURFACE,
      });
    }
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const handleClick = useCallback((slug: string) => {
    window.location.href = `/${slug}`;
  }, []);

  const { accent: accentColor, surface: surfaceColor } = colors;

  // Precompute positions
  const posMap = new Map<string, [number, number]>();
  for (const node of CS_RADIAL_NODES) {
    posMap.set(node.id, nodePosition(node));
  }

  // Build adjacency set for hover
  const adjacency = new Map<string, Set<string>>();
  for (const node of CS_RADIAL_NODES) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of CS_RADIAL_EDGES) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const isConnected = (nodeId: string): boolean => {
    if (!hoveredId) return false;
    return hoveredId === nodeId || (adjacency.get(hoveredId)?.has(nodeId) ?? false);
  };

  // Determine if an edge should be visible
  const isEdgeVisible = (source: string, target: string): boolean => {
    if (!hoveredId) return false;
    // Hub spokes (center edges) always hidden at rest
    return hoveredId === source || hoveredId === target;
  };

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: '550px' }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {/* Definitions */}
        <defs>
          <pattern id={dotGridId} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.8" fill={surfaceColor} opacity={0.5} />
          </pattern>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={VB_W} height={VB_H} fill={`url(#${dotGridId})`} />

        {/* Ring boundary ellipses (dashed) */}
        {RINGS.filter(r => r.radius > 0).map(ring => (
          <path
            key={`ring-${ring.index}`}
            d={isometricEllipsePath(ring.radius, CX, CY)}
            fill="none"
            stroke={surfaceColor}
            strokeWidth={1}
            strokeDasharray="6 4"
            opacity={0.4}
          />
        ))}

        {/* Ring labels */}
        {RINGS.filter(r => r.radius > 0).map(ring => {
          // Place label at the top of the ellipse (angle = -90 deg in polar → top of circle)
          const [px, py] = polarToCartesian(ring.radius, -90);
          const [ix, iy] = toIso(px, py);
          return (
            <text
              key={`ring-label-${ring.index}`}
              x={CX + ix}
              y={CY + iy - 10}
              textAnchor="middle"
              fontSize={9}
              fill={surfaceColor}
              opacity={0.7}
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
            >
              {ring.label}
            </text>
          );
        })}

        {/* Edges — only visible on hover */}
        {CS_RADIAL_EDGES.map((edge, i) => {
          const sp = posMap.get(edge.source);
          const tp = posMap.get(edge.target);
          if (!sp || !tp) return null;

          const visible = isEdgeVisible(edge.source, edge.target);
          const highlighted = hoveredId === edge.source || hoveredId === edge.target;

          return (
            <line
              key={`edge-${i}`}
              x1={sp[0]}
              y1={sp[1]}
              x2={tp[0]}
              y2={tp[1]}
              stroke={highlighted ? accentColor : surfaceColor}
              strokeWidth={highlighted ? 2 : 1}
              strokeDasharray={highlighted ? 'none' : '4 4'}
              opacity={visible ? 0.6 : 0}
              style={{ transition: 'opacity 0.25s ease, stroke 0.2s ease' }}
            />
          );
        })}

        {/* Nodes */}
        {CS_RADIAL_NODES.map(node => {
          const pos = posMap.get(node.id)!;
          const [nx, ny] = pos;
          const isHovered = hoveredId === node.id;
          const isCenter = node.ring === 0;
          const connected = isConnected(node.id);
          const blockSize = node.size * (isHovered ? 1.15 : 1);

          // Determine node opacity based on hover state
          let nodeOpacity = 1;
          if (hoveredId && !isHovered && !connected && !isCenter) {
            nodeOpacity = 0.3;
          }

          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
              opacity={nodeOpacity}
              onMouseEnter={() => {
                if (leaveTimerRef.current) {
                  clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = null;
                }
                setHoveredId(node.id);
                if (lastSoundNodeRef.current !== node.id) {
                  playHoverTick();
                  lastSoundNodeRef.current = node.id;
                }
              }}
              onMouseLeave={() => {
                leaveTimerRef.current = setTimeout(() => {
                  setHoveredId(null);
                  lastSoundNodeRef.current = null;
                }, 100);
              }}
              onClick={() => handleClick(node.slug)}
            >
              {/* Invisible hit area */}
              <circle
                cx={nx}
                cy={ny - blockSize * 0.05}
                r={node.size * 1.2}
                fill="transparent"
              />
              <IsometricBlock
                cx={nx}
                cy={ny}
                size={blockSize}
                color={isCenter ? accentColor : (isHovered || connected ? accentColor : surfaceColor)}
                opacity={isHovered || isCenter ? 1 : 0.8}
              />

              {/* Label */}
              <text
                x={nx}
                y={ny + blockSize * 0.5 + (isCenter ? 22 : 16)}
                textAnchor="middle"
                fontSize={isCenter ? 11 : node.ring === 4 ? 8 : 9}
                fontWeight={isCenter ? 700 : 400}
                fill={isHovered || isCenter || connected ? accentColor : '#525252'}
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'fill 0.2s ease',
                }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
