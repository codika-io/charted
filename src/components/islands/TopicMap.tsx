import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { playHoverTick } from '../../lib/hover-sound';

interface TopicNode {
  id: string;
  label: string;
  slug: string;
  x: number;
  y: number;
  size: number;
}

interface TopicEdge {
  source: string;
  target: string;
}

const TOPICS: TopicNode[] = [
  { id: 'math', label: 'Mathematics', slug: 'mathematics', x: 0, y: 0, size: 48 },
  { id: 'logic', label: 'Logic', slug: 'mathematics/logic', x: -280, y: -80, size: 30 },
  { id: 'set-theory', label: 'Set Theory', slug: 'mathematics/set-theory', x: -180, y: -180, size: 30 },
  { id: 'number-theory', label: 'Number Theory', slug: 'mathematics/number-theory', x: 40, y: -200, size: 34 },
  { id: 'algebra', label: 'Algebra', slug: 'mathematics/algebra', x: -200, y: 60, size: 36 },
  { id: 'geometry', label: 'Geometry', slug: 'mathematics/geometry', x: 200, y: -120, size: 36 },
  { id: 'topology', label: 'Topology', slug: 'mathematics/topology', x: 240, y: 60, size: 30 },
  { id: 'analysis', label: 'Analysis', slug: 'mathematics/analysis', x: 60, y: 140, size: 36 },
  { id: 'combinatorics', label: 'Combinatorics', slug: 'mathematics/combinatorics', x: -100, y: 200, size: 30 },
  { id: 'probability', label: 'Probability', slug: 'mathematics/probability', x: 280, y: 180, size: 30 },
];

// Edges follow the prerequisite / dependency structure
const EDGES: TopicEdge[] = [
  // From center
  { source: 'math', target: 'logic' },
  { source: 'math', target: 'set-theory' },
  { source: 'math', target: 'number-theory' },
  { source: 'math', target: 'algebra' },
  { source: 'math', target: 'geometry' },
  { source: 'math', target: 'topology' },
  { source: 'math', target: 'analysis' },
  { source: 'math', target: 'combinatorics' },
  { source: 'math', target: 'probability' },
  // Foundational chain
  { source: 'logic', target: 'set-theory' },
  { source: 'set-theory', target: 'number-theory' },
  { source: 'number-theory', target: 'algebra' },
  // Cross-links
  { source: 'algebra', target: 'geometry' },
  { source: 'algebra', target: 'topology' },
  { source: 'geometry', target: 'topology' },
  { source: 'topology', target: 'analysis' },
  { source: 'algebra', target: 'combinatorics' },
  { source: 'number-theory', target: 'combinatorics' },
  { source: 'analysis', target: 'probability' },
  { source: 'combinatorics', target: 'probability' },
];

// Isometric projection helpers
function toIso(x: number, y: number): [number, number] {
  const isoX = (x - y) * Math.cos(Math.PI / 6);
  const isoY = (x + y) * Math.sin(Math.PI / 6);
  return [isoX, isoY];
}

function IsometricBlock({ cx, cy, size, color, opacity = 1 }: { cx: number; cy: number; size: number; color: string; opacity?: number }) {
  const h = size * 0.6;
  const w = size;

  // Top face
  const top = `${cx},${cy - h} ${cx + w / 2},${cy - h + w / 4} ${cx},${cy - h + w / 2} ${cx - w / 2},${cy - h + w / 4}`;
  // Right face
  const right = `${cx},${cy - h + w / 2} ${cx + w / 2},${cy - h + w / 4} ${cx + w / 2},${cy + w / 4} ${cx},${cy + w / 2}`;
  // Left face
  const left = `${cx},${cy - h + w / 2} ${cx - w / 2},${cy - h + w / 4} ${cx - w / 2},${cy + w / 4} ${cx},${cy + w / 2}`;

  return (
    <g opacity={opacity}>
      <polygon points={left} fill={color} opacity={0.7} />
      <polygon points={right} fill={color} opacity={0.5} />
      <polygon points={top} fill={color} opacity={0.9} />
      {/* Edges */}
      <polygon points={top} fill="none" stroke={color} strokeWidth={1.5} opacity={0.9} />
      <polygon points={right} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
      <polygon points={left} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
    </g>
  );
}

// Default colors (used during SSR and as fallback)
const DEFAULT_ACCENT = '#ef4444';
const DEFAULT_SURFACE = '#d4d4d4';

export default function TopicMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [colors, setColors] = useState({ accent: DEFAULT_ACCENT, surface: DEFAULT_SURFACE });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(450, Math.min(rect.width * 0.6, 600)),
        });
      }
    };

    // Read CSS custom properties on mount
    const styles = getComputedStyle(document.documentElement);
    setColors({
      accent: styles.getPropertyValue('--color-accent-500').trim() || DEFAULT_ACCENT,
      surface: styles.getPropertyValue('--color-surface-300').trim() || DEFAULT_SURFACE,
    });

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleClick = useCallback((slug: string) => {
    window.location.href = `/${slug}`;
  }, []);

  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;

  // Scale factor for responsiveness
  const scale = Math.min(width / 800, height / 500, 1);

  const accentColor = colors.accent;
  const surfaceColor = colors.surface;

  const nodeMap = new Map(TOPICS.map(t => [t.id, t]));

  return (
    <div ref={containerRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="w-full h-auto"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {/* Dot grid background */}
        <defs>
          <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.8" fill={surfaceColor} opacity={0.5} />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill="url(#dotGrid)" />

        {/* Edges */}
        {EDGES.map((edge, i) => {
          const source = nodeMap.get(edge.source)!;
          const target = nodeMap.get(edge.target)!;
          const [sx, sy] = toIso(source.x * scale, source.y * scale);
          const [tx, ty] = toIso(target.x * scale, target.y * scale);
          const isHighlighted = hoveredId === edge.source || hoveredId === edge.target;

          return (
            <line
              key={`edge-${i}`}
              x1={centerX + sx}
              y1={centerY + sy}
              x2={centerX + tx}
              y2={centerY + ty}
              stroke={isHighlighted ? accentColor : surfaceColor}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={isHighlighted ? 'none' : '4 4'}
              opacity={hoveredId && !isHighlighted ? 0.2 : 0.6}
              style={{ transition: 'all 0.2s ease' }}
            />
          );
        })}

        {/* Nodes */}
        {TOPICS.map(topic => {
          const [ix, iy] = toIso(topic.x * scale, topic.y * scale);
          const nx = centerX + ix;
          const ny = centerY + iy;
          const isHovered = hoveredId === topic.id;
          const isCenter = topic.id === 'math';
          const blockSize = topic.size * scale * (isHovered ? 1.15 : 1);

          return (
            <g
              key={topic.id}
              style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
              onMouseEnter={() => { setHoveredId(topic.id); playHoverTick(); }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(topic.slug)}
              opacity={hoveredId && !isHovered && hoveredId !== 'math' ? 0.4 : 1}
            >
              <IsometricBlock
                cx={nx}
                cy={ny}
                size={blockSize}
                color={isCenter ? accentColor : (isHovered ? accentColor : surfaceColor)}
                opacity={isHovered || isCenter ? 1 : 0.8}
              />

              {/* Label */}
              <text
                x={nx}
                y={ny + blockSize * 0.5 + 18}
                textAnchor="middle"
                fontSize={isCenter ? 11 : 10}
                fontWeight={isCenter ? 700 : 400}
                fill={isHovered || isCenter ? accentColor : '#525252'}
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'fill 0.2s ease',
                }}
              >
                {topic.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
