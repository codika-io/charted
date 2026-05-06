#!/usr/bin/env node
/**
 * Build the topic graph used by the atlas and topic-page mini-graph.
 *
 * Reads every non-archived MDX under src/content/topics/, computes the full
 * forward + backward prerequisite closures for each node, joins reviewer
 * registry data, and emits src/generated/graph.json.
 *
 * Runs as `predev` and `prebuild` so the generated file is always fresh.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOPICS_DIR = join(ROOT, 'src', 'content', 'topics');
const OUT_DIR = join(ROOT, 'src', 'generated');
const OUT_FILE = join(OUT_DIR, 'graph.json');
const REVIEWERS_FILE = join(ROOT, 'reviewers.yml');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.mdx')) yield full;
  }
}

function topicIdFromPath(absPath) {
  return relative(TOPICS_DIR, absPath).replace(/\.mdx$/, '').replace(/\/index$/, '');
}

const nodes = new Map();

for (const file of walk(TOPICS_DIR)) {
  const id = topicIdFromPath(file);
  const { data } = matter(readFileSync(file, 'utf8'));
  if (data.status === 'archived') continue;

  nodes.set(id, {
    id,
    title: data.title,
    description: data.description,
    parent: data.parent,
    color: data.color ?? '#ef4444',
    difficulty: data.difficulty ?? 'beginner',
    status: data.status ?? 'stub',
    tier: data.reviewTier ?? 'foundation',
    sourcesCount: Array.isArray(data.sources) ? data.sources.length : 0,
    prerequisites: Array.isArray(data.prerequisites) ? [...data.prerequisites] : [],
    reviewIssue: data.reviewIssue,
    lastEditedBy: data.lastEditedBy,
    reviewerHandles: [],
    ancestors: [],
    descendants: [],
  });
}

// Drop prerequisite edges that point to archived/missing topics.
const skippedEdges = [];
for (const node of nodes.values()) {
  node.prerequisites = node.prerequisites.filter(p => {
    if (nodes.has(p)) return true;
    skippedEdges.push({ from: p, to: node.id });
    return false;
  });
}

// Build the edge list (prerequisite edges only — parent is taxonomy, not learning order).
const edges = [];
for (const node of nodes.values()) {
  for (const pre of node.prerequisites) {
    edges.push({ from: pre, to: node.id, kind: 'prerequisite' });
  }
}

// Forward + backward closures via BFS.
function closure(startId, getNeighbours) {
  const seen = new Set();
  const queue = [...getNeighbours(startId)];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of getNeighbours(id)) queue.push(n);
  }
  return [...seen];
}

const fwd = new Map();
const bwd = new Map();
for (const id of nodes.keys()) {
  fwd.set(id, []);
  bwd.set(id, []);
}
for (const e of edges) {
  bwd.get(e.to).push(e.from);
  fwd.get(e.from).push(e.to);
}

// Drop pure category nodes — anything with no prerequisite edges in or out.
// These are taxonomy containers (domain roots, branch indexes) that aren't
// themselves learnable topics. Their pages still exist; they just don't appear
// in the atlas graph.
const isolated = [];
for (const id of [...nodes.keys()]) {
  if ((bwd.get(id) ?? []).length === 0 && (fwd.get(id) ?? []).length === 0) {
    isolated.push(id);
    nodes.delete(id);
    fwd.delete(id);
    bwd.delete(id);
  }
}

for (const node of nodes.values()) {
  node.ancestors = closure(node.id, id => bwd.get(id) ?? []);
  node.descendants = closure(node.id, id => fwd.get(id) ?? []);
}

// Reviewer overlay.
let reviewers = [];
if (existsSync(REVIEWERS_FILE)) {
  try {
    const parsed = parseYaml(readFileSync(REVIEWERS_FILE, 'utf8'));
    if (Array.isArray(parsed)) reviewers = parsed;
  } catch (e) {
    console.warn(`[build-graph] failed to parse reviewers.yml: ${e.message}`);
  }
}

for (const r of reviewers) {
  if (!r?.github || !Array.isArray(r.expertise)) continue;
  for (const topicId of r.expertise) {
    // expertise can name a branch — credit reviewers to that branch and all descendants.
    for (const node of nodes.values()) {
      if (node.id === topicId || node.ancestors.includes(topicId) || node.id.startsWith(topicId + '/')) {
        if (!node.reviewerHandles.includes(r.github)) node.reviewerHandles.push(r.github);
      }
    }
  }
}

// Topological depth = layer in the DAG (foundations at depth 0, frontier at the top).
const depth = new Map();
function depthOf(id) {
  if (depth.has(id)) return depth.get(id);
  const ins = bwd.get(id) ?? [];
  const d = ins.length === 0 ? 0 : 1 + Math.max(...ins.map(depthOf));
  depth.set(id, d);
  return d;
}
for (const id of nodes.keys()) {
  const node = nodes.get(id);
  node.depth = depthOf(id);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
  edges: edges.sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)),
  reviewers,
};
writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));

console.log(`[build-graph] wrote ${OUT_FILE}`);
console.log(`  nodes: ${payload.nodes.length}`);
console.log(`  edges: ${payload.edges.length}`);
console.log(`  reviewers: ${payload.reviewers.length}`);
if (skippedEdges.length) {
  console.log(`  dropped prerequisite edges (target archived/missing): ${skippedEdges.length}`);
  for (const e of skippedEdges) console.log(`    ${e.to} → ${e.from}`);
}
if (isolated.length) {
  console.log(`  dropped category nodes (no prerequisite edges): ${isolated.length}`);
  for (const id of isolated) console.log(`    ${id}`);
}
