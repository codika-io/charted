#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';

const TOPICS_DIR = join(import.meta.dirname, '..', 'src', 'content', 'topics');

const DOMAIN_CONFIG = {
  mathematics: {
    label: 'Mathematics',
    branches: [
      'logic', 'set-theory', 'number-theory', 'algebra', 'geometry',
      'topology', 'analysis', 'combinatorics', 'probability', 'applied-mathematics',
    ],
    names: {
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
    },
  },
  'computer-science': {
    label: 'Computer Science',
    branches: [
      'algorithms', 'data-structures', 'theory-of-computation',
      'programming-languages', 'systems', 'machine-learning', 'cryptography',
    ],
    names: {
      'algorithms': 'Algorithms & Complexity',
      'data-structures': 'Data Structures',
      'theory-of-computation': 'Theory of Computation',
      'programming-languages': 'Programming Languages',
      'systems': 'Computer Systems',
      'machine-learning': 'Machine Learning',
      'cryptography': 'Cryptography',
    },
  },
};

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

function getDomainAndBranch(filePath) {
  const rel = relative(TOPICS_DIR, filePath);
  const parts = rel.split('/');
  // <domain>/branch/file.mdx → { domain, branch }
  // <domain>/branch/index.mdx → null (branch index)
  // <domain>/index.mdx → null (domain root)
  if (parts.length < 3) return null;
  const domain = parts[0];
  const branch = parts[1];
  const file = parts[parts.length - 1];
  if (file === 'index.mdx' && parts.length === 3) return null;
  return { domain, branch };
}

// Collect all sub-topic files
const allFiles = walkMdx(TOPICS_DIR);
const data = {}; // domain → branch → items[]

for (const filePath of allFiles) {
  const info = getDomainAndBranch(filePath);
  if (!info) continue;

  const { domain, branch } = info;
  if (!data[domain]) data[domain] = {};
  if (!data[domain][branch]) data[domain][branch] = [];

  const fm = parseFrontmatter(filePath);
  const rel = relative(TOPICS_DIR, filePath).replace(/\.mdx$/, '');
  data[domain][branch].push({
    path: rel,
    title: fm.title || '(untitled)',
    status: fm.status || 'stub',
    author: fm.author || '-',
    lastUpdated: fm.lastUpdated || '-',
  });
}

const pad = (s, n) => s.toString().padEnd(n);
const rpad = (s, n) => s.toString().padStart(n);

console.log('');
console.log('Charted Content Progress');
console.log('========================');

let grandTotals = { total: 0, stub: 0, draft: 0, review: 0, complete: 0 };
const allStubs = [];

for (const [domainSlug, config] of Object.entries(DOMAIN_CONFIG)) {
  const branches = data[domainSlug] || {};

  console.log('');
  console.log(`── ${config.label} ──`);
  console.log('');
  console.log(
    pad('Branch', 28) +
    rpad('Total', 6) +
    rpad('Stub', 6) +
    rpad('Draft', 7) +
    rpad('Review', 8) +
    rpad('Complete', 9)
  );
  console.log('─'.repeat(64));

  let totals = { total: 0, stub: 0, draft: 0, review: 0, complete: 0 };

  for (const slug of config.branches) {
    const items = branches[slug] || [];
    const counts = { stub: 0, draft: 0, review: 0, complete: 0 };
    for (const item of items) {
      counts[item.status] = (counts[item.status] || 0) + 1;
      if (item.status === 'stub') allStubs.push(item.path);
    }

    const name = config.names[slug] || slug;
    console.log(
      pad(name, 28) +
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

  console.log('─'.repeat(64));
  const drafted = totals.draft + totals.review + totals.complete;
  const pct = totals.total > 0 ? ((drafted / totals.total) * 100).toFixed(1) : '0.0';
  console.log(
    pad(`${config.label} Total`, 28) +
    rpad(totals.total, 6) +
    rpad(totals.stub, 6) +
    rpad(totals.draft, 7) +
    rpad(totals.review, 8) +
    rpad(totals.complete, 9) +
    `  (${pct}% drafted)`
  );

  grandTotals.total += totals.total;
  grandTotals.stub += totals.stub;
  grandTotals.draft += totals.draft;
  grandTotals.review += totals.review;
  grandTotals.complete += totals.complete;
}

// Grand total
console.log('');
console.log('═'.repeat(64));
const grandDrafted = grandTotals.draft + grandTotals.review + grandTotals.complete;
const grandPct = grandTotals.total > 0 ? ((grandDrafted / grandTotals.total) * 100).toFixed(1) : '0.0';
console.log(
  pad('Grand Total', 28) +
  rpad(grandTotals.total, 6) +
  rpad(grandTotals.stub, 6) +
  rpad(grandTotals.draft, 7) +
  rpad(grandTotals.review, 8) +
  rpad(grandTotals.complete, 9) +
  `  (${grandPct}% drafted)`
);

if (allStubs.length > 0) {
  console.log('');
  console.log('Next stubs to fill:');
  for (const s of allStubs.slice(0, 8)) {
    console.log(`  ${s}`);
  }
  if (allStubs.length > 8) {
    console.log(`  ... and ${allStubs.length - 8} more`);
  }
}

console.log('');
