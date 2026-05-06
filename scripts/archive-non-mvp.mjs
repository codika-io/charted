#!/usr/bin/env node
/**
 * Archive every topic outside the MVP keep-list.
 *
 * The MVP focuses on the closure of topics needed to understand modern
 * machine learning / NLP frontier papers. Everything else is rewritten
 * to `status: archived` so the visualization, atlas, and status page
 * filter it out, but the content stays on disk.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '..', 'src', 'content', 'topics');

// Topic IDs that survive the MVP cut. Format: relative path under topics/ without .mdx.
// Branch indexes (`*/index`) are listed without the `/index` suffix to match content collection IDs.
const KEEP = new Set([
  // Roots
  'mathematics',
  'computer-science',

  // Math: linear algebra, probability, calculus, optimization, info theory, graph theory
  'mathematics/algebra',
  'mathematics/algebra/linear-algebra',
  'mathematics/probability',
  'mathematics/probability/probability-theory',
  'mathematics/probability/mathematical-statistics',
  'mathematics/applied-mathematics',
  'mathematics/applied-mathematics/optimization',
  'mathematics/applied-mathematics/information-theory',
  'mathematics/applied-mathematics/numerical-analysis',
  'mathematics/analysis',
  'mathematics/analysis/real-analysis',
  'mathematics/combinatorics',
  'mathematics/combinatorics/graph-theory',

  // CS: theoretical foundations + AI/ML branch
  'computer-science/theoretical-foundations',
  'computer-science/theoretical-foundations/algorithms-and-complexity',
  'computer-science/theoretical-foundations/data-structures',
  'computer-science/theoretical-foundations/discrete-mathematics',
  'computer-science/theoretical-foundations/information-theory',
  'computer-science/ai-and-machine-learning',
  'computer-science/ai-and-machine-learning/machine-learning',
  'computer-science/ai-and-machine-learning/artificial-intelligence',
  'computer-science/ai-and-machine-learning/natural-language-processing',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.mdx')) yield full;
  }
}

function topicIdFromPath(absPath) {
  const rel = relative(TOPICS_DIR, absPath).replace(/\.mdx$/, '');
  // Astro content-collection IDs strip trailing /index
  return rel.replace(/\/index$/, '');
}

let archived = 0;
let kept = 0;
let alreadyArchived = 0;

for (const file of walk(TOPICS_DIR)) {
  const id = topicIdFromPath(file);
  const raw = readFileSync(file, 'utf8');
  const parsed = matter(raw);

  if (KEEP.has(id)) {
    kept++;
    continue;
  }

  if (parsed.data.status === 'archived') {
    alreadyArchived++;
    continue;
  }

  parsed.data.status = 'archived';
  const out = matter.stringify(parsed.content, parsed.data);
  writeFileSync(file, out);
  archived++;
}

console.log(`MVP archive complete:`);
console.log(`  kept:     ${kept}`);
console.log(`  archived: ${archived}`);
console.log(`  already:  ${alreadyArchived}`);
