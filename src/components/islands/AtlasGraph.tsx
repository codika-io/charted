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

type RawNode = {
  id: string;
  title: string;
  description?: string;
  color: string;
  tier: 'foundation' | 'field' | 'frontier';
  status: string;
  ancestors: string[];
  descendants: string[];
  reviewerHandles: string[];
  /** Precomputed coordinates from build-graph.mjs. When present, the
   *  simulation is skipped on the initial paint. */
  x?: number;
  y?: number;
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
  outDegree: number;
  inDegree: number;
};

type SimEdge = { source: SimNode | string; target: SimNode | string };

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
  const total = n.outDegree + n.inDegree;
  const base = 10;
  const growth = Math.min(8, total * 1.2);
  const tierBoost = n.tier === 'foundation' ? 4 : n.tier === 'field' ? 2 : 0;
  return base + growth + tierBoost;
}

// Zoom threshold above which every (non-dimmed) label becomes visible.
const LABEL_ZOOM_THRESHOLD = 1.0;

export default function AtlasGraph({
  nodes: rawNodes,
  edges: rawEdges,
  initialRoot,
  initialMode,
  height = 640,
  compact = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [width, setWidth] = useState(800);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);
  const [root, setRoot] = useState<string | null>(initialRoot ?? null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerBrowseAll, setPickerBrowseAll] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [hasSettled, setHasSettled] = useState(false);
  const [focusView, setFocusView] = useState<{
    focusId: string;
    neighborIds: Set<string>;
    prevTransform: { k: number; x: number; y: number };
  } | null>(null);
  const localSimRef = useRef<Simulation<SimNode, undefined> | null>(null);
  // Mirror of `transform` for reading the current value inside rAF callbacks.
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const animRef = useRef<number | null>(null);

  // Smoothly animate transform → target over durationMs (easeOutCubic).
  // Cancels any in-flight animation. Final value is also written into the
  // d3-zoom behavior so subsequent user wheel/drag starts from the new spot.
  const animateToTransform = useCallback((to: { k: number; x: number; y: number }, durationMs = 420) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const from = { ...transformRef.current };
    // No-op if already at target.
    if (Math.abs(from.k - to.k) < 1e-4 && Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const e = 1 - Math.pow(1 - t, 3);
      const k = from.k + (to.k - from.k) * e;
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      // Drive the animation through d3-zoom so svg.__zoom stays consistent
      // (the zoom 'zoom' handler is what updates the React `transform` state).
      if (svgRef.current && zoomBehaviorRef.current) {
        const z = zoomIdentity.translate(x, y).scale(k);
        select(svgRef.current).call(zoomBehaviorRef.current.transform, z);
      }
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef<{ node: SimNode; pointerId: number } | null>(null);

  // ── Build sim nodes/edges (once per data change), seeded from precomputed
  // coordinates when available so the first frame is already settled. ──
  useEffect(() => {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const e of rawEdges) {
      outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }
    const allPrePositioned = rawNodes.every(n => n.x !== undefined && n.y !== undefined);
    simNodesRef.current = rawNodes.map(n => ({
      ...n,
      outDegree: outDegree.get(n.id) ?? 0,
      inDegree: inDegree.get(n.id) ?? 0,
    }));
    simEdgesRef.current = rawEdges.map(e => ({ source: e.from, target: e.to }));
    setHasSettled(allPrePositioned);
  }, [rawNodes, rawEdges]);

  // ── Resize observer ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.max(1, Math.floor(e.contentRect.width)));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Initial fit-to-view: center the precomputed coords inside the canvas
  // and pick a zoom level that fits everything plus a bit of padding. ──
  const initialFitRef = useRef(false);
  useEffect(() => {
    if (initialFitRef.current || width === 0) return;
    const nodes = simNodesRef.current;
    if (nodes.length === 0) return;
    if (nodes.some(n => n.x === undefined || n.y === undefined)) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = radiusFor(n);
      if ((n.x! - r) < minX) minX = n.x! - r;
      if ((n.y! - r) < minY) minY = n.y! - r;
      if ((n.x! + r) > maxX) maxX = n.x! + r;
      if ((n.y! + r) > maxY) maxY = n.y! + r;
    }
    const padding = 40;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const k = Math.min(width / contentW, height / contentH, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = width / 2 - cx * k;
    const ty = height / 2 - cy * k;
    setTransform({ k, x: tx, y: ty });
    initialFitRef.current = true;

    // Sync the d3-zoom behavior so subsequent wheel/drag interactions start
    // from the same transform.
    queueMicrotask(() => {
      if (svgRef.current && zoomBehaviorRef.current) {
        const z = zoomIdentity.translate(tx, ty).scale(k);
        select(svgRef.current).call(zoomBehaviorRef.current.transform, z);
      }
    });
  }, [width, height, rawNodes]);

  // ── Simulation — only runs when nodes lack precomputed positions, or when
  // the user drags / selects something. We seed from precomputed (x, y) when
  // present and start cold. ──
  useEffect(() => {
    if (width === 0 || simNodesRef.current.length === 0) return;

    const allPre = simNodesRef.current.every(n => n.x !== undefined && n.y !== undefined);

    const cx = width / 2;
    const cy = height / 2;
    const domainOf = (n: SimNode) => n.id.split('/')[0];
    const uniqueDomains = Array.from(new Set(simNodesRef.current.map(domainOf)));
    const domainCenters = new Map<string, { x: number; y: number }>();
    const orbitRadius = Math.min(width, height) * 0.32;
    uniqueDomains.forEach((d, i) => {
      const angle = (i / uniqueDomains.length) * Math.PI * 2 - Math.PI / 2;
      domainCenters.set(d, {
        x: cx + Math.cos(angle) * orbitRadius * (width / Math.max(height, 1)),
        y: cy + Math.sin(angle) * orbitRadius,
      });
    });
    const domainCenterOf = (n: SimNode) =>
      domainCenters.get(domainOf(n)) ?? { x: cx, y: cy };

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
      .force('charge', forceManyBody<SimNode>().strength(d => -180 - anchorness(d) * 90))
      .force(
        'x',
        forceX<SimNode>(d => domainCenterOf(d).x).strength(d => 0.06 + anchorness(d) * 0.025),
      )
      .force(
        'y',
        forceY<SimNode>(d => domainCenterOf(d).y).strength(d => 0.06 + anchorness(d) * 0.025),
      )
      .force(
        'collide',
        forceCollide<SimNode>().radius(d => radiusFor(d) + 10).strength(1),
      )
      .alphaDecay(0.025);

    // If we have precomputed coords, freeze the sim until the user does
    // something (drag, select) — no initial settling needed. Otherwise let
    // it run normally and request redraws via RAF.
    if (allPre) {
      sim.alpha(0).stop();
    } else {
      sim.on('tick', () => requestRedraw());
      sim.on('end', () => setHasSettled(true));
    }

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [width, height, rawNodes]);

  // Sync transformRef with state so the animator + URL effects can read it.
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // ── Focus mode: smoothly pan the clicked node to the center of the view.
  // Zoom is left alone unless the user is so far out that the node would
  // appear tiny — then we boost to a comfortable min zoom. Freezes non-1-hop
  // neighbors so drags stay cheap (local-sim handles in-focus movement). ──
  useEffect(() => {
    if (compact) return;
    if (width === 0 || !hasSettled) return;

    if (!root) {
      // Exit focus mode: smoothly slide back to the prior view.
      if (focusView) {
        for (const n of simNodesRef.current) { n.fx = null; n.fy = null; }
        animateToTransform(focusView.prevTransform);
        setFocusView(null);
      }
      return;
    }

    if (focusView?.focusId === root) return;

    const node = simNodesRef.current.find(n => n.id === root);
    if (!node || node.x === undefined || node.y === undefined) return;

    // Compute 1-hop neighbor set — used for drag freezing only, not for fit.
    const oneHop = new Set<string>([root]);
    for (const e of rawEdges) {
      if (e.from === root) oneHop.add(e.to);
      if (e.to === root) oneHop.add(e.from);
    }

    // Keep current zoom; bump up to MIN_FOCUS_K only if we're zoomed out so far
    // the node would be hard to see.
    const MIN_FOCUS_K = 1.0;
    const targetK = Math.max(transformRef.current.k, MIN_FOCUS_K);
    const targetTransform = {
      k: targetK,
      x: width / 2 - node.x * targetK,
      y: height / 2 - node.y * targetK,
    };

    // Save the prior transform only on the first entry into focus mode, so the
    // "Back to overview" button restores the pre-focus camera (not the previous
    // focused node's camera).
    const prevTransform = focusView?.prevTransform ?? { ...transformRef.current };

    // Freeze non-neighbors at current positions, release neighbors so local
    // drag sim has room to spring.
    for (const n of simNodesRef.current) {
      if (oneHop.has(n.id)) { n.fx = null; n.fy = null; }
      else { n.fx = n.x ?? null; n.fy = n.y ?? null; }
    }
    if (simRef.current) simRef.current.stop();

    animateToTransform(targetTransform);
    setFocusView({ focusId: root, neighborIds: oneHop, prevTransform });
  }, [root, hasSettled, width, height, rawEdges, compact, focusView, animateToTransform]);

  // ── Auto-fit transform when a branch is filtered (chip click OR URL-driven
  // mount via ?branch=). Skipped while a focus view is active so the focused
  // neighborhood stays framed. ──
  useEffect(() => {
    if (compact) return;
    if (!branchFilter) return;
    if (focusView) return;
    if (width === 0 || !hasSettled) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of simNodesRef.current) {
      if (n.id.split('/')[0] !== branchFilter) continue;
      if (n.x === undefined || n.y === undefined) continue;
      const r = radiusFor(n);
      if (n.x - r < minX) minX = n.x - r;
      if (n.y - r < minY) minY = n.y - r;
      if (n.x + r > maxX) maxX = n.x + r;
      if (n.y + r > maxY) maxY = n.y + r;
    }
    if (!isFinite(minX)) return;
    const pad = 100;
    const contentW = (maxX - minX) + pad * 2;
    const contentH = (maxY - minY) + pad * 2;
    const newK = Math.min(width / contentW, height / contentH, 2.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const next = {
      k: newK,
      x: width / 2 - cx * newK,
      y: height / 2 - cy * newK,
    };
    animateToTransform(next);
  }, [branchFilter, hasSettled, width, height, compact, focusView, animateToTransform]);

  // ── URL state sync (atlas page only) ──
  useEffect(() => {
    if (compact) return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode') as Mode | null;
    const r = params.get('root');
    const b = params.get('branch');
    if (m) setMode(m);
    if (r) setRoot(r);
    if (b) setBranchFilter(b);
  }, [compact]);

  useEffect(() => {
    if (compact) return;
    const params = new URLSearchParams(window.location.search);
    if (mode) params.set('mode', mode);
    else params.delete('mode');
    if (root) params.set('root', root);
    else params.delete('root');
    if (branchFilter) params.set('branch', branchFilter);
    else params.delete('branch');
    const next = params.toString();
    const url = `${window.location.pathname}${next ? '?' + next : ''}`;
    window.history.replaceState(null, '', url);
  }, [mode, root, branchFilter, compact]);

  // ── Pan/zoom via d3-zoom on the SVG overlay (which sits on top of canvas) ──
  useEffect(() => {
    if (compact || !svgRef.current) return;
    const svg = select<SVGSVGElement, unknown>(svgRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter(event => {
        // Allow wheel/drag; suppress drag if a node-drag is active.
        if (draggingRef.current) return false;
        if (event.type === 'mousedown' && event.button !== 0) return false;
        return true;
      })
      .on('zoom', ev => {
        setTransform({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y });
      });
    zoomBehaviorRef.current = z;
    svg.call(z);
    // d3-zoom installs a default dblclick handler that zooms 2×; we want
    // dblclick to navigate to the topic page instead, so unbind it.
    svg.on('dblclick.zoom', null);
    return () => { svg.on('.zoom', null); };
  }, [compact]);

  // ── Highlight set ──
  const highlightSet = useMemo(() => {
    let base: Set<string> | null = null;
    if (root && mode) {
      const node = rawNodes.find(n => n.id === root);
      if (node) {
        if (mode === 'pathTo') base = new Set([root, ...node.ancestors]);
        else if (mode === 'whatsNext') base = new Set([root, ...node.descendants]);
        else if (mode === 'explore') {
          const oneHop = new Set<string>([root]);
          for (const e of rawEdges) {
            if (e.from === root) oneHop.add(e.to);
            if (e.to === root) oneHop.add(e.from);
          }
          base = oneHop;
        }
      }
    }
    if (branchFilter) {
      const inBranch = new Set<string>();
      for (const n of rawNodes) {
        if (n.id.split('/')[0] === branchFilter) inBranch.add(n.id);
      }
      if (base) {
        // Intersect: only keep highlighted nodes that also match the branch filter.
        const inter = new Set<string>();
        for (const id of base) if (inBranch.has(id)) inter.add(id);
        return inter;
      }
      return inBranch;
    }
    return base;
  }, [root, mode, rawNodes, rawEdges, branchFilter]);

  // Branch summary (domain id → canonical color + count). Used by legend, hulls, picker chips.
  const branches = useMemo(() => {
    const map = new Map<string, { color: string; count: number }>();
    for (const n of rawNodes) {
      const d = n.id.split('/')[0];
      const existing = map.get(d);
      if (!existing) map.set(d, { color: n.color, count: 1 });
      else existing.count++;
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [rawNodes]);

  // Cluster geometry per branch — recomputed when nodes settle or width changes.
  // We compute centroid + radius from current positions; stable enough once the
  // layout has settled.
  const clusterGeometry = useMemo(() => {
    const acc = new Map<string, { sx: number; sy: number; n: number; minX: number; maxX: number; minY: number; maxY: number; color: string }>();
    for (const n of simNodesRef.current) {
      if (n.x === undefined || n.y === undefined) continue;
      const d = n.id.split('/')[0];
      const r = radiusFor(n);
      const a = acc.get(d) ?? { sx: 0, sy: 0, n: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, color: n.color };
      a.sx += n.x;
      a.sy += n.y;
      a.n++;
      a.minX = Math.min(a.minX, n.x - r);
      a.maxX = Math.max(a.maxX, n.x + r);
      a.minY = Math.min(a.minY, n.y - r);
      a.maxY = Math.max(a.maxY, n.y + r);
      acc.set(d, a);
    }
    const out: Array<{ domain: string; cx: number; cy: number; r: number; color: string }> = [];
    for (const [d, a] of acc) {
      const cx = a.sx / a.n;
      const cy = a.sy / a.n;
      // Use distance-to-farthest-node as radius (better than half-bbox for ellipsoidal clusters).
      let maxDist = 0;
      for (const n of simNodesRef.current) {
        if (n.id.split('/')[0] !== d) continue;
        if (n.x === undefined || n.y === undefined) continue;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.hypot(dx, dy) + radiusFor(n);
        if (dist > maxDist) maxDist = dist;
      }
      out.push({ domain: d, cx, cy, r: maxDist + 24, color: a.color });
    }
    return out;
    // hasSettled is the trigger; positions are stable then.
  }, [hasSettled, rawNodes, width, height]);

  // One-hop neighbors of the focused node, used for the always-visible label set.
  const focusedNeighborSet = useMemo(() => {
    const id = hoverId ?? root;
    if (!id) return null;
    const s = new Set<string>([id]);
    for (const e of rawEdges) {
      if (e.from === id) s.add(e.to);
      if (e.to === id) s.add(e.from);
    }
    return s;
  }, [hoverId, root, rawEdges]);

  // ── Canvas draw loop. Decoupled from React; we paint imperatively. ──
  // drawCanvas closes over transform/hover/etc., so we hold the latest in a
  // ref to avoid stale closures inside the RAF callback.
  const drawRef = useRef<() => void>(() => {});

  const requestRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current();
    });
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { k, x: tx, y: ty } = transform;
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    const focusId = hoverId ?? root;

    // World → screen
    const sx = (wx: number) => wx * k + tx;
    const sy = (wy: number) => wy * k + ty;

    // Viewport in world coords (for culling)
    const worldMinX = (0 - tx) / k;
    const worldMinY = (0 - ty) / k;
    const worldMaxX = (w - tx) / k;
    const worldMaxY = (h - ty) / k;

    // ── Progressive tier disclosure based on zoom ──
    // Far out: only foundation. Mid: foundation + field. Close: everything.
    // Fade frontier in between k=0.7 and k=1.05, field in between k=0.45 and k=0.75.
    const fieldOpacity = Math.max(0, Math.min(1, (k - 0.45) / (0.75 - 0.45)));
    const frontierOpacity = Math.max(0, Math.min(1, (k - 0.7) / (1.05 - 0.7)));
    const tierVisibility = (tier: string) =>
      tier === 'foundation' ? 1 : tier === 'field' ? fieldOpacity : frontierOpacity;

    // ── Cluster labels at centroid (no hull behind, per design choice) ──
    if (clusterGeometry.length > 0) {
      // Scale with world so they stay readable,
      // capped so they don't dominate when zoomed way in.
      const labelSize = Math.max(14, Math.min(34, 22 * k));
      ctx.font = `600 ${labelSize}px var(--font-mono, ui-monospace, monospace)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of clusterGeometry) {
        const dim = branchFilter ? c.domain !== branchFilter : false;
        const label = (domainLabel[c.domain] ?? c.domain).toUpperCase();
        // Halo
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(250,250,250,0.85)';
        ctx.globalAlpha = dim ? 0.25 : 0.9;
        ctx.strokeText(label, sx(c.cx), sy(c.cy));
        // Fill
        ctx.fillStyle = c.color;
        ctx.globalAlpha = dim ? 0.2 : 0.55;
        ctx.fillText(label, sx(c.cx), sy(c.cy));
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
    }

    // ── Edges ──
    ctx.lineWidth = 1;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = e.source as SimNode;
      const t = e.target as SimNode;
      if (typeof s !== 'object' || typeof t !== 'object') continue;
      if (s.x === undefined || t.x === undefined) continue;

      // Cull edges entirely outside the viewport (bounding-box test).
      const eMinX = Math.min(s.x, t.x);
      const eMaxX = Math.max(s.x, t.x);
      const eMinY = Math.min(s.y!, t.y!);
      const eMaxY = Math.max(s.y!, t.y!);
      if (eMaxX < worldMinX || eMinX > worldMaxX || eMaxY < worldMinY || eMinY > worldMaxY) continue;

      // Hide edges that touch a hidden-tier node.
      const tierMin = Math.min(tierVisibility(s.tier), tierVisibility(t.tier));
      if (tierMin <= 0.01) continue;
      const dim = highlightSet ? !(highlightSet.has(s.id) && highlightSet.has(t.id)) : false;
      const focused = focusId && (s.id === focusId || t.id === focusId);
      const alpha = (dim ? 0.06 : focused ? 0.85 : 0.35) * tierMin;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = focused ? '#ef4444' : '#a3a3a3';
      ctx.lineWidth = focused ? 1.5 : 1;

      // Trim arrow to rim of target
      const dx = (t.x ?? 0) - (s.x ?? 0);
      const dy = (t.y ?? 0) - (s.y ?? 0);
      const len = Math.hypot(dx, dy) || 1;
      const tr = radiusFor(t);
      const tx2 = (t.x ?? 0) - (dx / len) * tr;
      const ty2 = (t.y ?? 0) - (dy / len) * tr;

      ctx.beginPath();
      ctx.moveTo(sx(s.x!), sy(s.y!));
      ctx.lineTo(sx(tx2), sy(ty2));
      ctx.stroke();

      // Arrowhead — only when zoomed in enough to see it, or when focused
      if (k > 0.6 || focused) {
        const ah = 5;
        const angle = Math.atan2(dy, dx);
        const tipX = sx(tx2);
        const tipY = sy(ty2);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - ah * Math.cos(angle - Math.PI / 6), tipY - ah * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tipX - ah * Math.cos(angle + Math.PI / 6), tipY - ah * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = focused ? '#ef4444' : '#a3a3a3';
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── Nodes ──
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const r = radiusFor(n);
      // Cull
      if (n.x + r < worldMinX || n.x - r > worldMaxX) continue;
      if (n.y + r < worldMinY || n.y - r > worldMaxY) continue;

      const tierAlpha = tierVisibility(n.tier);
      if (tierAlpha <= 0.01) continue;
      const dim = highlightSet ? !highlightSet.has(n.id) : false;
      const isRoot = root === n.id;
      const isHover = hoverId === n.id;
      ctx.globalAlpha = (dim ? 0.18 : 1) * tierAlpha;

      if (isRoot) {
        ctx.beginPath();
        ctx.arc(sx(n.x), sy(n.y), (r + 6) * k, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.arc(sx(n.x), sy(n.y), r * k, 0, Math.PI * 2);
      // Tier still drives fill (lighter = foundation, deeper = frontier) — but
      // the stroke now carries branch color, so the science branch is readable
      // at every zoom level.
      ctx.fillStyle = TIER_FILL[n.tier];
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = isHover || isRoot ? 2.5 : n.tier === 'foundation' ? 2 : 1.5;
      ctx.stroke();

      // Frontier tier gets a second thin inner ring to keep the tier distinction
      // visible now that fills are very similar — only when zoomed in enough.
      if (n.tier === 'frontier' && k > 0.9) {
        ctx.beginPath();
        ctx.arc(sx(n.x), sy(n.y), Math.max(1.5, (r - 3) * k), 0, Math.PI * 2);
        ctx.strokeStyle = TIER_STROKE.frontier;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // ── Labels (only when zoomed in OR for focused + neighbors) ──
    const showAllLabels = k >= LABEL_ZOOM_THRESHOLD;
    if (showAllLabels || focusedNeighborSet) {
      ctx.font = `10px var(--font-mono, ui-monospace, monospace)`;
      ctx.textBaseline = 'middle';
      // Two passes: stroke (halo) then fill, so labels stay readable over edges.
      const visibleLabels: SimNode[] = [];
      // Per-tier zoom thresholds — foundation (orientation anchors) appears
      // first as you zoom in, then field, then frontier.
      const tierLabelThreshold = (tier: string) =>
        tier === 'foundation' ? 0.55 : tier === 'field' ? 0.8 : LABEL_ZOOM_THRESHOLD;
      for (const n of nodes) {
        if (n.x === undefined || n.y === undefined) continue;
        if (tierVisibility(n.tier) < 0.15) continue;
        const isFocused = n.id === focusId;
        const inNeighborhood = focusedNeighborSet?.has(n.id) ?? false;
        const passesTier = k >= tierLabelThreshold(n.tier);
        if (!passesTier && !isFocused && !inNeighborhood) continue;
        const dim = highlightSet ? !highlightSet.has(n.id) : false;
        if (dim) continue;
        const r = radiusFor(n);
        if (n.x + r < worldMinX || n.x - r > worldMaxX) continue;
        if (n.y + r < worldMinY || n.y - r > worldMaxY) continue;
        visibleLabels.push(n);
      }

      // Stroke pass (halo)
      ctx.strokeStyle = '#fafafa';
      ctx.lineJoin = 'round';
      for (const n of visibleLabels) {
        const isFocused = n.id === focusId;
        const r = radiusFor(n);
        ctx.lineWidth = isFocused ? 5 : 3;
        ctx.strokeText(n.title, sx(n.x!) + r + 6, sy(n.y!) + 4);
      }
      // Fill pass
      for (const n of visibleLabels) {
        const isFocused = n.id === focusId;
        const r = radiusFor(n);
        ctx.fillStyle = isFocused ? '#171717' : '#525252';
        ctx.font = isFocused
          ? `600 10px var(--font-mono, ui-monospace, monospace)`
          : `10px var(--font-mono, ui-monospace, monospace)`;
        ctx.fillText(n.title, sx(n.x!) + r + 6, sy(n.y!) + 4);
      }
    }
  }, [transform, hoverId, root, highlightSet, focusedNeighborSet, clusterGeometry, branchFilter]);

  // Keep the ref pointing at the latest drawCanvas so the RAF callback
  // always sees the current transform/hover/highlight state.
  useEffect(() => { drawRef.current = drawCanvas; }, [drawCanvas]);

  // Redraw whenever any visual-state changes.
  useEffect(() => { requestRedraw(); }, [transform, hoverId, root, highlightSet, focusedNeighborSet, width, height, clusterGeometry, branchFilter, requestRedraw]);

  // ── Hit-testing for hover/click on the canvas ──
  const screenToWorld = useCallback((sxp: number, syp: number) => {
    return { x: (sxp - transform.x) / transform.k, y: (syp - transform.y) / transform.k };
  }, [transform]);

  const nodeAt = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(clientX - rect.left, clientY - rect.top);
    // Reverse iteration so visually-on-top nodes win (drawn last).
    const nodes = simNodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const r = radiusFor(n);
      const dx = w.x - n.x;
      const dy = w.y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }, [screenToWorld]);

  const onSvgMove = useCallback((ev: React.PointerEvent<SVGSVGElement>) => {
    if (draggingRef.current) {
      const d = draggingRef.current.node;
      const rect = canvasRef.current!.getBoundingClientRect();
      const w = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      d.fx = w.x;
      d.fy = w.y;
      d.x = w.x;
      d.y = w.y;
      requestRedraw();
      return;
    }
    const hit = nodeAt(ev.clientX, ev.clientY);
    setHoverId(hit?.id ?? null);
  }, [nodeAt, screenToWorld, requestRedraw]);

  const onSvgLeave = useCallback(() => {
    if (draggingRef.current) return;
    setHoverId(null);
  }, []);

  const onSvgDown = useCallback((ev: React.PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    const hit = nodeAt(ev.clientX, ev.clientY);
    if (!hit) return;
    // Begin a node drag — d3-zoom's filter will see this and skip panning.
    ev.preventDefault();
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    hit.fx = hit.x;
    hit.fy = hit.y;
    draggingRef.current = { node: hit, pointerId: ev.pointerId };

    // Build a tiny local simulation over the dragged node's 1-hop neighborhood
    // (intersected with the focus view if active), so the spring effect stays
    // responsive without dragging O(N²) force computations behind it.
    if (simRef.current) simRef.current.stop();
    const oneHop = new Set<string>([hit.id]);
    for (const e of rawEdges) {
      if (e.from === hit.id) oneHop.add(e.to);
      if (e.to === hit.id) oneHop.add(e.from);
    }
    const allowed = focusView
      ? new Set<string>([...oneHop].filter(id => focusView.neighborIds.has(id)))
      : oneHop;
    const localNodes = simNodesRef.current.filter(n => allowed.has(n.id));
    const localEdges: SimEdge[] = [];
    for (const e of simEdgesRef.current) {
      const sId = typeof e.source === 'object' ? (e.source as SimNode).id : e.source;
      const tId = typeof e.target === 'object' ? (e.target as SimNode).id : e.target;
      if (allowed.has(sId) && allowed.has(tId)) localEdges.push({ source: sId, target: tId });
    }
    // Release the local set from any prior freeze so the spring can play; the
    // dragged node stays fixed via fx/fy.
    for (const n of localNodes) {
      if (n.id !== hit.id) { n.fx = null; n.fy = null; }
    }
    const lsim = forceSimulation<SimNode>(localNodes)
      .force(
        'link',
        forceLink<SimNode, SimEdge>(localEdges)
          .id((d: SimNode) => d.id)
          .distance(110)
          .strength(0.6),
      )
      .force('charge', forceManyBody<SimNode>().strength(-220))
      .force('collide', forceCollide<SimNode>().radius(d => radiusFor(d) + 8).strength(0.9))
      .alphaDecay(0.04)
      .alphaTarget(0.3)
      .on('tick', () => requestRedraw());
    localSimRef.current = lsim;
  }, [compact, nodeAt, rawEdges, focusView, requestRedraw]);

  const onSvgUp = useCallback((ev: React.PointerEvent<SVGSVGElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    drag.node.fx = drag.node.x;
    drag.node.fy = drag.node.y;
    draggingRef.current = null;
    // Re-freeze any local-sim nodes outside the focus view so they don't drift,
    // then stop the local sim. If a focus view is active, neighbors stay loose
    // (their next drag will respring them); otherwise everyone gets pinned.
    if (localSimRef.current) {
      localSimRef.current.stop();
      if (!focusView) {
        for (const n of simNodesRef.current) {
          if (n.fx == null) { n.fx = n.x ?? null; n.fy = n.y ?? null; }
        }
      }
      localSimRef.current = null;
    }
    (ev.target as Element).releasePointerCapture?.(ev.pointerId);
  }, [focusView]);

  // Single-click selects (focus mode), double-click opens the topic page.
  // We defer the single-click action briefly so a real double-click cancels it
  // before focus mode kicks in — otherwise dblclick fires after a confusing
  // recenter from the first single-click.
  const clickTimerRef = useRef<number | null>(null);
  const onSvgClick = useCallback((ev: React.MouseEvent<SVGSVGElement>) => {
    if (compact) {
      const hit = nodeAt(ev.clientX, ev.clientY);
      if (hit) window.location.href = `/${hit.id}`;
      return;
    }
    const hit = nodeAt(ev.clientX, ev.clientY);
    if (!hit) return;
    if (ev.metaKey || ev.ctrlKey) {
      window.location.href = `/${hit.id}`;
      return;
    }
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
    }
    const id = hit.id;
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      setRoot(prev => (prev === id ? null : id));
    }, 320);
  }, [compact, nodeAt]);

  const onSvgDoubleClick = useCallback((ev: React.MouseEvent<SVGSVGElement>) => {
    const hit = nodeAt(ev.clientX, ev.clientY);
    if (!hit) return;
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    window.location.href = `/${hit.id}`;
  }, [nodeAt]);

  // ── Topic-picker outside-click + Escape ──
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

  const reset = useCallback(() => {
    setRoot(null);
    setMode(null);
    setBranchFilter(null);
    for (const n of simNodesRef.current) { n.fx = null; n.fy = null; }
    if (svgRef.current && zoomBehaviorRef.current) {
      // Re-fit to view.
      initialFitRef.current = false;
      // Trigger the fit effect on the next paint.
      setTransform(t => ({ ...t }));
    }
  }, []);

  const focusedId = hoverId ?? root;

  // Full grouped index — computed once, reused by both compact and browse modes.
  const groupedIndex = useMemo(() => {
    const byDomain = new Map<string, RawNode[]>();
    for (const n of rawNodes) {
      const domain = n.id.split('/')[0];
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(n);
    }
    const ordered = Array.from(byDomain.keys()).sort();
    return ordered.map(d => ({
      domain: d,
      items: byDomain.get(d)!.slice().sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [rawNodes]);

  // ── Searchable picker results. ──
  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) {
      // No query: compact mode caps each domain to 8; browse-all mode lists everything.
      const groups = groupedIndex.map(g => ({
        domain: g.domain,
        items: pickerBrowseAll ? g.items : g.items.slice(0, 8),
        truncated: pickerBrowseAll ? 0 : Math.max(0, g.items.length - 8),
        total: g.items.length,
      }));
      return { kind: 'grouped' as const, groups };
    }
    // Linear filter — fast enough on 2k entries.
    const hits: RawNode[] = [];
    const cap = pickerBrowseAll ? 500 : 50;
    for (const n of rawNodes) {
      if (n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
        hits.push(n);
        if (hits.length >= cap) break;
      }
    }
    return { kind: 'flat' as const, items: hits, cap };
  }, [pickerQuery, rawNodes, groupedIndex, pickerBrowseAll]);

  const domainLabel: Record<string, string> = {
    mathematics: 'Mathematics',
    'computer-science': 'Computer Science',
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
  };

  const selected = root ? rawNodes.find(n => n.id === root) : null;
  const triggerLabel = selected?.title ?? '— pick a topic —';

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

          <div ref={pickerRef} className="relative ml-2">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              onClick={() => {
                setPickerOpen(o => !o);
                setPickerQuery('');
              }}
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
                width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
              >
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </button>

            {pickerOpen && (
              <div
                role="listbox"
                className={`absolute left-0 top-full mt-1 z-30 max-w-[90vw] bg-white border border-surface-300 shadow-lg transition-[width] ${
                  pickerBrowseAll ? 'w-[32rem]' : 'w-[22rem]'
                }`}
              >
                <div className="border-b border-surface-200 p-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                    placeholder={pickerBrowseAll ? `Filter ${rawNodes.length} topics…` : `Search ${rawNodes.length} topics…`}
                    autoFocus
                    className="flex-1 font-mono text-xs px-2 py-1.5 border border-surface-200 focus:border-surface-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerBrowseAll(b => !b);
                      // When entering browse mode, default-expand every domain.
                      setExpandedDomains(
                        !pickerBrowseAll
                          ? new Set(groupedIndex.map(g => g.domain))
                          : new Set(),
                      );
                    }}
                    className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border transition-colors whitespace-nowrap ${
                      pickerBrowseAll
                        ? 'bg-surface-900 text-white border-surface-900'
                        : 'border-surface-300 text-surface-600 hover:border-surface-500'
                    }`}
                    title={pickerBrowseAll ? 'Back to quick picker' : 'Browse every topic, grouped by branch'}
                  >
                    {pickerBrowseAll ? '← Compact' : 'Browse all ↗'}
                  </button>
                </div>
                <div className={pickerBrowseAll ? 'max-h-[28rem] overflow-y-auto' : 'max-h-80 overflow-y-auto'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!root}
                    onClick={() => { setRoot(null); setPickerOpen(false); }}
                    className={`w-full text-left font-mono text-xs uppercase tracking-wider px-3 py-2 hover:bg-surface-100 transition-colors ${
                      !root ? 'bg-surface-50 text-surface-900' : 'text-surface-500'
                    }`}
                  >
                    — pick a topic —
                  </button>
                  {pickerResults.kind === 'grouped' && pickerResults.groups.map((g, i) => {
                    const isOpen = pickerBrowseAll ? expandedDomains.has(g.domain) : true;
                    return (
                      <div key={g.domain} className="border-t border-surface-200">
                        {pickerBrowseAll ? (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedDomains(prev => {
                                const next = new Set(prev);
                                if (next.has(g.domain)) next.delete(g.domain);
                                else next.add(g.domain);
                                return next;
                              });
                            }}
                            className="w-full text-left flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-surface-600 px-3 py-2 bg-surface-50 hover:bg-surface-100 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-2 h-2"
                                style={{ backgroundColor: g.items[0]?.color }}
                                aria-hidden="true"
                              />
                              {domainLabel[g.domain] ?? g.domain}
                              <span className="text-surface-400 normal-case tracking-normal">({g.total})</span>
                            </span>
                            <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                          </button>
                        ) : (
                          <div className="font-mono text-[10px] uppercase tracking-wider text-surface-400 px-3 py-1.5 bg-surface-50">
                            {domainLabel[g.domain] ?? g.domain}
                          </div>
                        )}
                        {isOpen && g.items.map(n => (
                          <PickerRow key={n.id} n={n} selected={n.id === root} onPick={() => { setRoot(n.id); setPickerOpen(false); }} />
                        ))}
                        {isOpen && g.truncated > 0 && (
                          <div className="font-mono text-[10px] text-surface-400 px-3 py-1.5 italic">
                            + {g.truncated} more — type to search or use Browse all
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pickerResults.kind === 'flat' && (
                    <div className="border-t border-surface-200">
                      {pickerResults.items.length === 0 && (
                        <div className="font-mono text-xs text-surface-400 px-3 py-3">No matches.</div>
                      )}
                      {pickerResults.items.map(n => (
                        <PickerRow key={n.id} n={n} selected={n.id === root} onPick={() => { setRoot(n.id); setPickerOpen(false); }} showDomain />
                      ))}
                      {pickerResults.items.length === pickerResults.cap && (
                        <div className="font-mono text-[10px] text-surface-400 px-3 py-1.5 italic">
                          Showing first {pickerResults.cap} — refine your search.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {(root || mode || branchFilter) && (
            <button
              onClick={reset}
              className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 text-surface-500 hover:text-surface-900"
            >
              Reset
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-surface-400 hidden md:block">
            click to focus · double-click to open · drag to move · scroll to zoom
          </span>
        </div>
      )}

      {!compact && branches.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mr-1">Branches:</span>
          {branches.map(b => {
            const active = branchFilter === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranchFilter(active ? null : b.id)}
                className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-surface-900 text-white border-surface-900'
                    : branchFilter
                      ? 'border-surface-200 text-surface-400 hover:border-surface-400 hover:text-surface-700'
                      : 'border-surface-300 text-surface-700 hover:border-surface-500'
                }`}
                aria-pressed={active}
                title={active ? 'Show all branches' : `Isolate ${domainLabel[b.id] ?? b.id}`}
              >
                <span
                  className="inline-block w-2 h-2"
                  style={{ backgroundColor: b.color }}
                  aria-hidden="true"
                />
                {domainLabel[b.id] ?? b.id}
                <span className={active ? 'text-white/60' : 'text-surface-400'}>{b.count}</span>
              </button>
            );
          })}
          {branchFilter && (
            <button
              type="button"
              onClick={() => setBranchFilter(null)}
              className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 text-surface-500 hover:text-surface-900"
            >
              clear
            </button>
          )}
        </div>
      )}

      <div
        style={{ height }}
        className="border border-surface-200 bg-surface-50 overflow-hidden relative"
      >
        {/* Background pattern */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e5e5 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full block touch-none"
          style={{ cursor: compact ? 'pointer' : (hoverId ? 'pointer' : 'grab') }}
          onPointerMove={onSvgMove}
          onPointerLeave={onSvgLeave}
          onPointerDown={onSvgDown}
          onPointerUp={onSvgUp}
          onClick={onSvgClick}
          onDoubleClick={onSvgDoubleClick}
        />

        {!hasSettled && !compact && (
          <div className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-wider text-surface-400 bg-white/80 px-2 py-1 border border-surface-200">
            settling…
          </div>
        )}

        {focusView && !compact && (
          <button
            type="button"
            onClick={() => setRoot(null)}
            className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-white border border-surface-300 text-surface-700 hover:border-surface-900 hover:text-surface-900 shadow-sm flex items-center gap-1.5"
            title="Restore the previous view"
          >
            <span aria-hidden="true">←</span>
            Back to overview
          </button>
        )}

        {focusedId && !compact && (() => {
          const n = simNodesRef.current.find(s => s.id === focusedId);
          if (!n) return null;
          return (
            <div className="absolute bottom-3 left-3 bg-white border border-surface-300 px-3 py-2 max-w-md shadow-sm">
              <div className="font-mono text-[10px] uppercase tracking-wider text-surface-400 mb-1">
                {n.tier} · in {n.inDegree} · out {n.outDegree}
              </div>
              <div className="text-sm leading-tight font-medium">{n.title}</div>
              {n.description && (
                <div className="text-xs text-surface-500 mt-1 line-clamp-2">{n.description}</div>
              )}
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

function PickerRow({
  n,
  selected,
  onPick,
  showDomain = false,
}: {
  n: RawNode;
  selected: boolean;
  onPick: () => void;
  showDomain?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={`w-full text-left font-mono text-xs px-3 py-1.5 transition-colors flex items-center gap-2 ${
        selected ? 'bg-accent-50 text-accent-700' : 'text-surface-700 hover:bg-surface-100'
      }`}
    >
      <span
        className="inline-block w-1.5 h-1.5 shrink-0"
        style={{ backgroundColor: n.color }}
        aria-hidden="true"
      />
      <span className="truncate">
        {showDomain && <span className="text-surface-400">{n.id.split('/')[0]} / </span>}
        {n.title}
      </span>
    </button>
  );
}
