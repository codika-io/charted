import { useEffect, useRef, useState, useCallback, useId, useMemo } from 'react';
import { playHoverTick } from '../../lib/hover-sound';
import { toIso, IsometricBlock, polarToCartesian, isometricEllipsePath } from '../../lib/isometric';
import type { RadialNode, RadialEdge, RingDef } from '../../lib/radial-types';

const DEFAULT_SURFACE = '#d4d4d4';

/** Extract the branch segment from a slug like "mathematics/logic/propositional-logic" → "logic". */
function getBranch(slug: string): string | null {
  const parts = slug.split('/');
  return parts.length >= 3 ? parts[1] : null;
}

interface RadialMapProps {
  nodes: RadialNode[];
  edges: RadialEdge[];
  rings: RingDef[];
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  centerOffsetY?: number;
  defaultAccent?: string;
}

export default function RadialMap({
  nodes,
  edges,
  rings,
  viewBoxWidth = 1100,
  viewBoxHeight = 750,
  centerOffsetY = -20,
  defaultAccent = '#3b82f6',
}: RadialMapProps) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [colors, setColors] = useState({ accent: defaultAccent, surface: DEFAULT_SURFACE });
  const lastSoundNodeRef = useRef<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus mode state
  const [focusedBranch, setFocusedBranch] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const VB_W = viewBoxWidth;
  const VB_H = viewBoxHeight;
  const CX = VB_W / 2;
  const CY = VB_H / 2 + centerOffsetY;

  const dotGridId = `radialDotGrid${uid}`;
  const glowId = `radialGlow${uid}`;

  /** Compute the isometric screen position for a radial node. */
  const nodePosition = useCallback((node: RadialNode): [number, number] => {
    if (node.ring === 0) return [CX, CY];
    const ring = rings[node.ring];
    if (!ring) return [CX, CY];
    const [px, py] = polarToCartesian(ring.radius, node.angleDeg);
    const [ix, iy] = toIso(px, py);
    return [CX + ix, CY + iy];
  }, [CX, CY, rings]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const styles = getComputedStyle(el);
      setColors({
        accent: styles.getPropertyValue('--color-accent-500').trim() || defaultAccent,
        surface: styles.getPropertyValue('--color-surface-300').trim() || DEFAULT_SURFACE,
      });
    }
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [defaultAccent]);

  /** Fade-based crossfade: fade out → switch state → fade in. */
  const triggerTransition = useCallback((stateChange: () => void) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setHoveredId(null);
    setTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      stateChange();
      transitionTimerRef.current = setTimeout(() => {
        setTransitioning(false);
        transitionTimerRef.current = null;
      }, 50);
    }, 200);
  }, []);

  const { accent: accentColor, surface: surfaceColor } = colors;

  // ─── Overview positions (memoized) ───
  const overviewPosMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const node of nodes) {
      map.set(node.id, nodePosition(node));
    }
    return map;
  }, [nodes, nodePosition]);

  // ─── Visible nodes in current mode ───
  const visibleNodes = useMemo(() => {
    if (!focusedBranch) return nodes;
    return nodes.filter(n => n.ring === 0 || getBranch(n.slug) === focusedBranch);
  }, [nodes, focusedBranch]);

  // ─── Visible edges (both endpoints must be visible) ───
  const visibleEdges = useMemo(() => {
    if (!focusedBranch) return edges;
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [edges, focusedBranch, visibleNodes]);

  // ─── Focus layout positions ───
  const focusPosMap = useMemo(() => {
    if (!focusedBranch) return null;
    const map = new Map<string, [number, number]>();
    const branchNodes = visibleNodes
      .filter(n => n.ring > 0)
      .sort((a, b) => a.ring - b.ring);

    // Center node stays put
    const center = visibleNodes.find(n => n.ring === 0);
    if (center) map.set(center.id, [CX, CY]);

    if (branchNodes.length <= 4) {
      // Single ring
      const radius = 160;
      const step = 360 / branchNodes.length;
      const offset = -90;
      branchNodes.forEach((node, i) => {
        const angle = offset + i * step;
        const [px, py] = polarToCartesian(radius, angle);
        const [ix, iy] = toIso(px, py);
        map.set(node.id, [CX + ix, CY + iy]);
      });
    } else {
      // Two rings — first half inner, second half outer
      const half = Math.ceil(branchNodes.length / 2);
      const innerNodes = branchNodes.slice(0, half);
      const outerNodes = branchNodes.slice(half);

      const innerRadius = 160;
      const outerRadius = 320;

      const innerStep = 360 / innerNodes.length;
      const innerOffset = -90;
      innerNodes.forEach((node, i) => {
        const angle = innerOffset + i * innerStep;
        const [px, py] = polarToCartesian(innerRadius, angle);
        const [ix, iy] = toIso(px, py);
        map.set(node.id, [CX + ix, CY + iy]);
      });

      const outerStep = 360 / outerNodes.length;
      const outerOffset = -90 + innerStep / 2;
      outerNodes.forEach((node, i) => {
        const angle = outerOffset + i * outerStep;
        const [px, py] = polarToCartesian(outerRadius, angle);
        const [ix, iy] = toIso(px, py);
        map.set(node.id, [CX + ix, CY + iy]);
      });
    }

    return map;
  }, [focusedBranch, visibleNodes, CX, CY]);

  // ─── Focus ring definitions ───
  const focusRingDefs = useMemo((): RingDef[] => {
    if (!focusedBranch) return [];
    const branchNodes = visibleNodes.filter(n => n.ring > 0);
    if (branchNodes.length <= 4) {
      return [{ index: 1, label: '', radius: 160 }];
    }
    return [
      { index: 1, label: '', radius: 160 },
      { index: 2, label: '', radius: 320 },
    ];
  }, [focusedBranch, visibleNodes]);

  // Active position map and ring defs
  const posMap = focusPosMap ?? overviewPosMap;
  const activeRings = focusedBranch ? focusRingDefs : rings.filter(r => r.radius > 0);

  // Build adjacency set from visible edges
  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const node of visibleNodes) {
      adj.set(node.id, new Set());
    }
    for (const edge of visibleEdges) {
      adj.get(edge.source)?.add(edge.target);
      adj.get(edge.target)?.add(edge.source);
    }
    return adj;
  }, [visibleNodes, visibleEdges]);

  const isConnected = (nodeId: string): boolean => {
    if (!hoveredId) return false;
    return hoveredId === nodeId || (adjacency.get(hoveredId)?.has(nodeId) ?? false);
  };

  const isEdgeVisible = (source: string, target: string): boolean => {
    if (focusedBranch) return true; // Always show edges in focus mode
    if (!hoveredId) return false;
    return hoveredId === source || hoveredId === target;
  };

  // Determine max ring index for font size scaling
  const maxRing = Math.max(...rings.map(r => r.index));

  // ─── Click handler: two-level drill-down ───
  const handleClick = useCallback((node: RadialNode) => {
    const isCenter = node.ring === 0;

    if (!focusedBranch) {
      // Overview mode
      if (isCenter) {
        // Center node → navigate to domain page
        window.location.href = `/${node.slug}`;
      } else {
        // Topic node → zoom into its branch
        const branch = getBranch(node.slug);
        if (branch) {
          triggerTransition(() => setFocusedBranch(branch));
        }
      }
    } else {
      // Focus mode
      if (isCenter) {
        // Center node → exit focus, back to overview
        triggerTransition(() => setFocusedBranch(null));
      } else {
        // Topic node → navigate to topic page
        window.location.href = `/${node.slug}`;
      }
    }
  }, [focusedBranch, triggerTransition]);

  // Branch display name for breadcrumb
  const branchLabel = useMemo(() => {
    if (!focusedBranch) return '';
    return focusedBranch.replace(/-/g, ' ');
  }, [focusedBranch]);

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: '550px', position: 'relative' }}>
      {/* Breadcrumb overlay in focus mode */}
      {focusedBranch && !transitioning && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            zIndex: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#525252',
            cursor: 'pointer',
          }}
          onClick={() => triggerTransition(() => setFocusedBranch(null))}
        >
          <span style={{ color: accentColor }}>{'<-'}</span>{' '}
          <span style={{ borderBottom: '1px dashed #a3a3a3' }}>all topics</span>
          {' / '}
          <span style={{ color: accentColor, fontWeight: 600 }}>{branchLabel}</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        overflow="visible"
        style={{
          fontFamily: 'var(--font-mono)',
          opacity: transitioning ? 0 : 1,
          transition: 'opacity 0.2s ease',
          pointerEvents: transitioning ? 'none' : 'auto',
        }}
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
        {activeRings.map(ring => (
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

        {/* Ring labels (overview only) */}
        {!focusedBranch && rings.filter(r => r.radius > 0).map(ring => {
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

        {/* Edges */}
        {visibleEdges.map((edge, i) => {
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
              opacity={visible ? (focusedBranch ? 0.35 : 0.6) : 0}
              style={{ transition: 'opacity 0.25s ease, stroke 0.2s ease' }}
            />
          );
        })}

        {/* Nodes */}
        {visibleNodes.map(node => {
          const pos = posMap.get(node.id);
          if (!pos) return null;
          const [nx, ny] = pos;
          const isHovered = hoveredId === node.id;
          const isCenter = node.ring === 0;
          const connected = isConnected(node.id);
          const sizeMult = focusedBranch ? 1.2 : 1;
          const blockSize = node.size * sizeMult * (isHovered ? 1.15 : 1);

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
              onClick={() => handleClick(node)}
            >
              {/* Invisible hit area */}
              <circle
                cx={nx}
                cy={ny - blockSize * 0.05}
                r={node.size * 1.2 * sizeMult}
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
                fontSize={isCenter ? 11 : (focusedBranch ? 10 : (node.ring === maxRing ? 8 : 9))}
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

              {/* "BACK" sub-label on center node in focus mode */}
              {isCenter && focusedBranch && (
                <text
                  x={nx}
                  y={ny + blockSize * 0.5 + 36}
                  textAnchor="middle"
                  fontSize={8}
                  fill={surfaceColor}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                  }}
                >
                  {'<- back'}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
