import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';

type RawNode = {
  id: string;
  title: string;
  description: string;
  color: string;
  tier: 'foundation' | 'field' | 'frontier';
  status: string;
  ancestors: string[];
  descendants: string[];
  reviewerHandles: string[];
};

type RawEdge = { from: string; to: string };

type Mode = 'pathTo' | 'whatsNext' | 'explore';

type Props = {
  nodes: RawNode[];
  edges: RawEdge[];
  initialRoot?: string | null;
  initialMode?: Mode;
  height?: number;
  /** Compact mode — no controls, used for the topic-page mini-graph. */
  compact?: boolean;
};

type SimNode = SimulationNodeDatum & RawNode & {
  /** Computed once per simulation: out-degree (foundationness) for sizing/coloring. */
  outDegree: number;
  inDegree: number;
};

type SimEdge = {
  source: SimNode | string;
  target: SimNode | string;
};

const TIER_FILL: Record<string, string> = {
  foundation: '#fafafa',
  field: '#fef2f2',
  frontier: '#fee2e2',
};

const TIER_STROKE: Record<string, string> = {
  foundation: '#a3a3a3',
  field: '#ef4444',
  frontier: '#b91c1c',
};

function radiusFor(n: { outDegree: number; inDegree: number; tier: string }) {
  // Foundations (lots of outgoing edges, no incoming) get bigger; frontier topics get smaller.
  const total = n.outDegree + n.inDegree;
  const base = 10;
  const growth = Math.min(8, total * 1.2);
  const tierBoost = n.tier === 'foundation' ? 4 : n.tier === 'field' ? 2 : 0;
  return base + growth + tierBoost;
}

export default function AtlasGraph({
  nodes: rawNodes,
  edges: rawEdges,
  initialRoot,
  initialMode,
  height = 640,
  compact = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [width, setWidth] = useState(800);
  const [tick, setTick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);
  const [root, setRoot] = useState<string | null>(initialRoot ?? null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // ── Topic-picker: close on outside click + Escape ──
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // ── Resize observer ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Build sim nodes/edges (once per data change) ──
  useEffect(() => {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const e of rawEdges) {
      outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }
    simNodesRef.current = rawNodes.map(n => ({
      ...n,
      outDegree: outDegree.get(n.id) ?? 0,
      inDegree: inDegree.get(n.id) ?? 0,
    }));
    simEdgesRef.current = rawEdges.map(e => ({ source: e.from, target: e.to }));
  }, [rawNodes, rawEdges]);

  // ── Simulation lifecycle ──
  useEffect(() => {
    if (width === 0) return;
    const cx = width / 2;
    const cy = height / 2;

    // Group nodes by top-level domain (e.g. "mathematics", "biology").
    // Each domain gets its own anchor point on a circle around the canvas,
    // so disconnected disciplines pull apart instead of all stacking on (cx, cy).
    const domainOf = (n: SimNode) => n.id.split('/')[0];
    const uniqueDomains = Array.from(new Set(simNodesRef.current.map(domainOf)));
    const domainCenters = new Map<string, { x: number; y: number }>();
    const orbitRadius = Math.min(width, height) * 0.32;
    uniqueDomains.forEach((d, i) => {
      // Spread domains on a circle, biased toward landscape canvases.
      const angle = (i / uniqueDomains.length) * Math.PI * 2 - Math.PI / 2;
      domainCenters.set(d, {
        x: cx + Math.cos(angle) * orbitRadius * (width / Math.max(height, 1)),
        y: cy + Math.sin(angle) * orbitRadius,
      });
    });
    const domainCenterOf = (n: SimNode) =>
      domainCenters.get(domainOf(n)) ?? { x: cx, y: cy };

    // "Anchorness" = how much a node behaves as a foundation pillar. Tier-foundation
    // nodes and high-degree nodes get a strong pull to their domain center and a
    // heavier charge so satellites orbit around them rather than mingling.
    const anchorness = (n: SimNode) => {
      const deg = n.outDegree + n.inDegree;
      const tierBoost = n.tier === 'foundation' ? 2 : n.tier === 'field' ? 1 : 0;
      return Math.min(8, deg * 0.5) + tierBoost;
    };

    const sim = forceSimulation<SimNode>(simNodesRef.current)
      .force(
        'link',
        forceLink<SimNode, SimEdge>(simEdgesRef.current as SimEdge[])
          .id((d: SimNode) => d.id)
          .distance(d => {
            const target = d.target as SimNode;
            return target.tier === 'frontier' ? 70 : 110;
          })
          .strength(0.7),
      )
      // Stronger repulsion overall and no distanceMax cap so disconnected
      // disciplines actually push each other across the canvas. Bigger nodes
      // push harder, becoming the gravitational anchors Luca asked for.
      .force(
        'charge',
        forceManyBody<SimNode>().strength(d => -180 - anchorness(d) * 90),
      )
      // Per-domain centroids replace the single global center.
      .force(
        'x',
        forceX<SimNode>(d => domainCenterOf(d).x).strength(d =>
          0.06 + anchorness(d) * 0.025,
        ),
      )
      .force(
        'y',
        forceY<SimNode>(d => domainCenterOf(d).y).strength(d =>
          0.06 + anchorness(d) * 0.025,
        ),
      )
      .force(
        'collide',
        forceCollide<SimNode>().radius(d => radiusFor(d) + 10).strength(1),
      )
      .alphaDecay(0.025);

    sim.on('tick', () => setTick(t => t + 1));
    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [width, height]);

  // ── Re-heat sim when root changes (selection re-settles the layout) ──
  useEffect(() => {
    if (!simRef.current) return;
    simRef.current.alpha(0.6).restart();
  }, [root]);

  // ── URL state sync (atlas page only) ──
  useEffect(() => {
    if (compact) return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode') as Mode | null;
    const r = params.get('root');
    if (m) setMode(m);
    if (r) setRoot(r);
  }, [compact]);

  useEffect(() => {
    if (compact) return;
    const params = new URLSearchParams(window.location.search);
    if (mode) params.set('mode', mode);
    else params.delete('mode');
    if (root) params.set('root', root);
    else params.delete('root');
    const next = params.toString();
    const url = `${window.location.pathname}${next ? '?' + next : ''}`;
    window.history.replaceState(null, '', url);
  }, [mode, root, compact]);

  // ── Pan/zoom (atlas mode only) ──
  useEffect(() => {
    if (compact || !svgRef.current) return;
    const svg = select<SVGSVGElement, unknown>(svgRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .filter(event => {
        // Don't intercept clicks on nodes — let them propagate.
        const target = event.target as Element;
        return !target.closest('[data-node-id]');
      })
      .on('zoom', ev => {
        setTransform({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y });
      });
    zoomBehaviorRef.current = z;
    svg.call(z);
    return () => {
      svg.on('.zoom', null);
    };
  }, [compact]);

  // ── Highlight set computation ──
  const highlightSet = useMemo(() => {
    if (!root || !mode) return null;
    const node = rawNodes.find(n => n.id === root);
    if (!node) return null;
    if (mode === 'pathTo') return new Set([root, ...node.ancestors]);
    if (mode === 'whatsNext') return new Set([root, ...node.descendants]);
    if (mode === 'explore') {
      const oneHop = new Set<string>([root]);
      for (const e of rawEdges) {
        if (e.from === root) oneHop.add(e.to);
        if (e.to === root) oneHop.add(e.from);
      }
      return oneHop;
    }
    return null;
  }, [root, mode, rawNodes, rawEdges]);

  const handleNodeClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (compact) return;
      e.preventDefault();
      // Click toggles selection; cmd/ctrl-click navigates to the page.
      if (e.metaKey || e.ctrlKey) {
        window.location.href = `/${id}`;
        return;
      }
      setRoot(prev => (prev === id ? null : id));
    },
    [compact],
  );

  const reset = useCallback(() => {
    setRoot(null);
    setMode(null);
    // Clear any user-pinned positions so the simulation reflows organically.
    for (const n of simNodesRef.current) {
      n.fx = null;
      n.fy = null;
    }
    if (simRef.current) simRef.current.alpha(0.5).restart();
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity);
    }
  }, []);

  // ── Drag-to-reposition. Pin node on drag, leave pinned on release ──
  // (user can clear pins via Reset). Looks up the SimNode by data-node-id
  // attribute so we don't have to rebind d3 data with React-owned DOM.
  const nodesGroupRef = useRef<SVGGElement | null>(null);
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  useEffect(() => {
    if (compact || !nodesGroupRef.current || !simRef.current) return;
    const sim = simRef.current;

    const lookup = (el: SVGGElement | null): SimNode | null => {
      if (!el) return null;
      const id = el.getAttribute('data-node-id');
      if (!id) return null;
      return simNodesRef.current.find(n => n.id === id) ?? null;
    };

    const dragBehavior = drag<SVGGElement, unknown>()
      .subject((event) => lookup(event.sourceEvent.currentTarget as SVGGElement))
      .on('start', function (event) {
        const d = lookup(this);
        if (!d) return;
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function (event) {
        const d = lookup(this);
        if (!d) return;
        const k = transformRef.current.k || 1;
        d.fx = (d.fx ?? d.x ?? 0) + event.dx / k;
        d.fy = (d.fy ?? d.y ?? 0) + event.dy / k;
      })
      .on('end', function (event) {
        const d = lookup(this);
        if (!d) return;
        if (!event.active) sim.alphaTarget(0);
        // Stay pinned where the user dropped it. Reset clears pins.
        d.fx = d.x;
        d.fy = d.y;
      });

    select<SVGGElement, unknown>(nodesGroupRef.current)
      .selectAll<SVGGElement, unknown>('g[data-node-id]')
      .call(dragBehavior);
  }, [compact, tick]);

  // Suppress unused-var warning while keeping the tick re-render dependency.
  void tick;

  const focusedId = hoverId ?? root;

  return (
    <div ref={containerRef} className="relative">
      {!compact && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <span className="font-mono text-xs uppercase tracking-wider text-surface-500 mr-2">View:</span>
          {(['pathTo', 'whatsNext', 'explore'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(mode === m ? null : m)}
              className={`font-mono text-xs uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                mode === m
                  ? 'bg-surface-900 text-white border-surface-900'
                  : 'border-surface-300 text-surface-600 hover:border-surface-500'
              } ${!root ? 'opacity-50' : ''}`}
              disabled={!root}
              title={!root ? 'Pick a topic first' : ''}
            >
              {m === 'pathTo' && 'Path to'}
              {m === 'whatsNext' && "What's next"}
              {m === 'explore' && 'Explore'}
            </button>
          ))}
          {(() => {
            // Custom listbox (square corners, opens below trigger, fully branded).
            const byDomain = new Map<string, RawNode[]>();
            for (const n of rawNodes) {
              const domain = n.id.split('/')[0];
              if (!byDomain.has(domain)) byDomain.set(domain, []);
              byDomain.get(domain)!.push(n);
            }
            const domainLabel: Record<string, string> = {
              mathematics: 'Mathematics',
              'computer-science': 'Computer Science',
              physics: 'Physics',
              chemistry: 'Chemistry',
              biology: 'Biology',
            };
            const orderedDomains = ['mathematics', 'computer-science', 'physics', 'chemistry', 'biology'].filter(d => byDomain.has(d));
            const selected = root ? rawNodes.find(n => n.id === root) : null;
            const triggerLabel = selected?.title ?? '— pick a topic —';

            return (
              <div ref={pickerRef} className="relative ml-2">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen(o => !o)}
                  className={`appearance-none font-mono text-xs uppercase tracking-wider pl-3 pr-9 py-1.5 border bg-white cursor-pointer transition-colors min-w-[14rem] text-left ${
                    pickerOpen
                      ? 'border-surface-900 text-surface-900'
                      : selected
                        ? 'border-surface-300 text-surface-900 hover:border-surface-500'
                        : 'border-surface-300 text-surface-500 hover:border-surface-500'
                  }`}
                >
                  <span className="block truncate">{triggerLabel}</span>
                  <svg
                    className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                </button>

                {pickerOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 top-full mt-1 z-30 min-w-full max-h-80 overflow-y-auto bg-white border border-surface-300 shadow-lg"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={!root}
                      onClick={() => {
                        setRoot(null);
                        setPickerOpen(false);
                      }}
                      className={`w-full text-left font-mono text-xs uppercase tracking-wider px-3 py-2 hover:bg-surface-100 transition-colors ${
                        !root ? 'bg-surface-50 text-surface-900' : 'text-surface-500'
                      }`}
                    >
                      — pick a topic —
                    </button>
                    {orderedDomains.map((d, i) => (
                      <div key={d} className={i > 0 ? 'border-t border-surface-200' : 'border-t border-surface-200'}>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-surface-400 px-3 py-1.5 bg-surface-50">
                          {domainLabel[d] ?? d}
                        </div>
                        {byDomain
                          .get(d)!
                          .slice()
                          .sort((a, b) => a.title.localeCompare(b.title))
                          .map(n => {
                            const isSel = n.id === root;
                            return (
                              <button
                                key={n.id}
                                type="button"
                                role="option"
                                aria-selected={isSel}
                                onClick={() => {
                                  setRoot(n.id);
                                  setPickerOpen(false);
                                }}
                                className={`w-full text-left font-mono text-xs px-3 py-1.5 transition-colors flex items-center gap-2 ${
                                  isSel
                                    ? 'bg-accent-50 text-accent-700'
                                    : 'text-surface-700 hover:bg-surface-100'
                                }`}
                              >
                                <span
                                  className="inline-block w-1.5 h-1.5 shrink-0"
                                  style={{ backgroundColor: n.color }}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{n.title}</span>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {(root || mode) && (
            <button
              onClick={reset}
              className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 text-surface-500 hover:text-surface-900"
            >
              Reset
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-surface-400 hidden md:block">
            click to select · drag to move · ⌘-click to open · scroll to zoom
          </span>
        </div>
      )}

      <div
        style={{ height }}
        className="border border-surface-200 bg-surface-50 overflow-hidden relative"
      >
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          className="block touch-none"
          style={{ cursor: compact ? 'default' : 'grab' }}
        >
          <defs>
            <pattern id="atlas-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#e5e5e5" />
            </pattern>
            <marker
              id="atlas-arrow"
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,-5L10,0L0,5" fill="#a3a3a3" />
            </marker>
            <marker
              id="atlas-arrow-active"
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,-5L10,0L0,5" fill="#ef4444" />
            </marker>
          </defs>

          <rect width="100%" height={height} fill="url(#atlas-dots)" />

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* edges */}
            <g>
              {simEdgesRef.current.map((e, i) => {
                const s = e.source as SimNode;
                const t = e.target as SimNode;
                if (typeof s !== 'object' || typeof t !== 'object' || s.x === undefined || t.x === undefined) return null;
                const dim = highlightSet ? !(highlightSet.has(s.id) && highlightSet.has(t.id)) : false;
                const focused =
                  focusedId && (s.id === focusedId || t.id === focusedId);
                const stroke = focused ? '#ef4444' : '#a3a3a3';
                const opacity = dim ? 0.08 : focused ? 0.85 : 0.45;
                // Trim arrow to the rim of the target node so the marker doesn't sit inside the circle.
                const dx = (t.x ?? 0) - (s.x ?? 0);
                const dy = (t.y ?? 0) - (s.y ?? 0);
                const len = Math.hypot(dx, dy) || 1;
                const tr = radiusFor(t);
                const tx = (t.x ?? 0) - (dx / len) * tr;
                const ty = (t.y ?? 0) - (dy / len) * tr;
                return (
                  <line
                    key={i}
                    x1={s.x}
                    y1={s.y}
                    x2={tx}
                    y2={ty}
                    stroke={stroke}
                    strokeWidth={focused ? 1.5 : 1}
                    opacity={opacity}
                    markerEnd={focused ? 'url(#atlas-arrow-active)' : 'url(#atlas-arrow)'}
                    style={{ transition: 'opacity 200ms, stroke 200ms' }}
                  />
                );
              })}
            </g>

            {/* nodes (circles only — labels render in a separate pass on top) */}
            <g ref={nodesGroupRef}>
              {simNodesRef.current.map(n => {
                if (n.x === undefined || n.y === undefined) return null;
                const dim = highlightSet ? !highlightSet.has(n.id) : false;
                const isRoot = root === n.id;
                const isHover = hoverId === n.id;
                const r = radiusFor(n);
                return (
                  <g
                    key={n.id}
                    data-node-id={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{
                      opacity: dim ? 0.18 : 1,
                      transition: 'opacity 250ms',
                      cursor: compact ? 'pointer' : 'grab',
                    }}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={e => handleNodeClick(n.id, e)}
                  >
                    {isRoot && (
                      <circle
                        r={r + 6}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      r={r}
                      fill={TIER_FILL[n.tier]}
                      stroke={TIER_STROKE[n.tier]}
                      strokeWidth={isHover || isRoot ? 2 : 1.25}
                      style={{ transition: 'stroke-width 150ms' }}
                    />
                    <circle r={2} fill={n.color} />
                  </g>
                );
              })}
            </g>

            {/* labels (rendered last so no node circle covers any text;
                focused/hovered label is sorted last so it sits above peers) */}
            <g style={{ pointerEvents: 'none' }}>
              {simNodesRef.current
                .slice()
                .sort((a, b) => {
                  const af = a.id === focusedId ? 1 : 0;
                  const bf = b.id === focusedId ? 1 : 0;
                  return af - bf;
                })
                .map(n => {
                  if (n.x === undefined || n.y === undefined) return null;
                  const dim = highlightSet ? !highlightSet.has(n.id) : false;
                  const isRoot = root === n.id;
                  const isHover = hoverId === n.id;
                  const r = radiusFor(n);
                  const labelVisible = !compact || isHover || isRoot;
                  if (!labelVisible) return null;
                  const isFocused = n.id === focusedId;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      style={{ opacity: dim ? 0.18 : 1, transition: 'opacity 250ms' }}
                    >
                      <text
                        x={r + 6}
                        y={4}
                        fontSize={10}
                        fontFamily="var(--font-mono), ui-monospace, monospace"
                        fill="#fafafa"
                        stroke="#fafafa"
                        strokeWidth={isFocused ? 5 : 3}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        style={{ userSelect: 'none' }}
                      >
                        {n.title}
                      </text>
                      <text
                        x={r + 6}
                        y={4}
                        fontSize={10}
                        fontFamily="var(--font-mono), ui-monospace, monospace"
                        fill={isFocused ? '#171717' : '#525252'}
                        fontWeight={isFocused ? 600 : 400}
                        style={{ userSelect: 'none' }}
                      >
                        {n.title}
                      </text>
                    </g>
                  );
                })}
            </g>
          </g>
        </svg>

        {/* Hover info panel */}
        {focusedId && !compact && (() => {
          const n = simNodesRef.current.find(s => s.id === focusedId);
          if (!n) return null;
          return (
            <div className="absolute bottom-3 left-3 bg-white border border-surface-300 px-3 py-2 max-w-md shadow-sm">
              <div className="font-mono text-[10px] uppercase tracking-wider text-surface-400 mb-1">
                {n.tier} · in {n.inDegree} · out {n.outDegree}
              </div>
              <div className="text-sm leading-tight font-medium">{n.title}</div>
              <div className="text-xs text-surface-500 mt-1 line-clamp-2">{n.description}</div>
              <a
                href={`/${n.id}`}
                className="font-mono text-[10px] uppercase tracking-wider text-accent-600 hover:text-accent-800 mt-2 inline-block"
              >
                Open page →
              </a>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
