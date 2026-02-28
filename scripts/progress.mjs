#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';

const TOPICS_DIR = join(import.meta.dirname, '..', 'src', 'content', 'topics');

function walkMdx(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkMdx(full));
    } else if (entry.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  return data;
}

function getBranch(filePath) {
  const rel = relative(TOPICS_DIR, filePath);
  const parts = rel.split('/');
  // mathematics/branch/file.mdx → branch
  // mathematics/branch/index.mdx → null (it's a branch index)
  if (parts.length < 3) return null; // top-level (mathematics/index.mdx or mathematics/branch.mdx)
  const branch = parts[1];
  const file = parts[parts.length - 1];
  // Skip branch index files
  if (file === 'index.mdx' && parts.length === 3) return null;
  return branch;
}

function getBranchName(slug) {
  const names = {
    'logic': 'Logic & Foundations',
    'set-theory': 'Set Theory',
    'number-theory': 'Number Theory',
    'algebra': 'Algebra',
    'geometry': 'Geometry',
    'topology': 'Topology',
    'analysis': 'Analysis',
    'combinatorics': 'Combinatorics',
    'probability': 'Probability & Statistics',
    'applied-mathematics': 'Applied Mathematics',
  };
  return names[slug] || slug;
}

// Collect all sub-topic files
const allFiles = walkMdx(TOPICS_DIR);
const branches = {};

for (const filePath of allFiles) {
  const branch = getBranch(filePath);
  if (!branch) continue;

  const fm = parseFrontmatter(filePath);
  if (!branches[branch]) branches[branch] = [];

  const rel = relative(TOPICS_DIR, filePath).replace(/\.mdx$/, '');
  branches[branch].push({
    path: rel,
    title: fm.title || '(untitled)',
    status: fm.status || 'stub',
    author: fm.author || '-',
    lastUpdated: fm.lastUpdated || '-',
  });
}

// Sort branches by predefined order
const branchOrder = [
  'logic', 'set-theory', 'number-theory', 'algebra', 'geometry',
  'topology', 'analysis', 'combinatorics', 'probability', 'applied-mathematics',
];

// Print header
console.log('');
console.log('Charted Content Progress');
console.log('========================');
console.log('');

const pad = (s, n) => s.toString().padEnd(n);
const rpad = (s, n) => s.toString().padStart(n);

console.log(
  pad('Branch', 28) +
  rpad('Total', 6) +
  rpad('Stub', 6) +
  rpad('Draft', 7) +
  rpad('Review', 8) +
  rpad('Complete', 9)
);
console.log('\u2500'.repeat(64));

let totals = { total: 0, stub: 0, draft: 0, review: 0, complete: 0 };
const stubs = [];

for (const slug of branchOrder) {
  const items = branches[slug] || [];
  const counts = { stub: 0, draft: 0, review: 0, complete: 0 };
  for (const item of items) {
    counts[item.status] = (counts[item.status] || 0) + 1;
    if (item.status === 'stub') stubs.push(item.path);
  }

  console.log(
    pad(getBranchName(slug), 28) +
    rpad(items.length, 6) +
    rpad(counts.stub, 6) +
    rpad(counts.draft, 7) +
    rpad(counts.review, 8) +
    rpad(counts.complete, 9)
  );

  totals.total += items.length;
  totals.stub += counts.stub;
  totals.draft += counts.draft;
  totals.review += counts.review;
  totals.complete += counts.complete;
}

console.log('\u2500'.repeat(64));

const drafted = totals.draft + totals.review + totals.complete;
const pct = totals.total > 0 ? ((drafted / totals.total) * 100).toFixed(1) : '0.0';

console.log(
  pad('Overall', 28) +
  rpad(totals.total, 6) +
  rpad(totals.stub, 6) +
  rpad(totals.draft, 7) +
  rpad(totals.review, 8) +
  rpad(totals.complete, 9) +
  `  (${pct}% drafted)`
);

if (stubs.length > 0) {
  console.log('');
  console.log('Next stubs to fill:');
  for (const s of stubs.slice(0, 8)) {
    console.log(`  ${s}`);
  }
  if (stubs.length > 8) {
    console.log(`  ... and ${stubs.length - 8} more`);
  }
}

console.log('');
