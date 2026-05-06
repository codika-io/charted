#!/usr/bin/env node
/**
 * Paper ingestion helper — feeds the MVP scoping decision and the
 * outreach flywheel.
 *
 * Usage:
 *   npm run ingest:paper -- <arxivId> [--anchor <topicId>]
 *
 * Given an arXiv ID it:
 *   1. Pulls metadata from the arXiv API (title, abstract, authors).
 *   2. If --anchor is given, computes |overlap| / |union| of the anchor
 *      topic's prerequisite closure against the current MVP closure.
 *   3. Emits a draft `sources:` YAML block to paste into the topic
 *      frontmatter, plus author keys to add to authors.yml.
 *
 * Network calls are made only when run; running this script is opt-in.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GRAPH_FILE = join(ROOT, 'src', 'generated', 'graph.json');

function parseArgs(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      out.flags[a.slice(2)] = argv[i + 1];
      i++;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const arxivId = positional[0];

if (!arxivId) {
  console.error('Usage: npm run ingest:paper -- <arxivId> [--anchor <topicId>]');
  process.exit(1);
}

if (!existsSync(GRAPH_FILE)) {
  console.error(`graph.json not found — run \`npm run graph\` first.`);
  process.exit(1);
}

const graph = JSON.parse(readFileSync(GRAPH_FILE, 'utf8'));

// ── arXiv metadata fetch ──
const arxivUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
console.log(`[ingest] fetching ${arxivUrl}`);
const xml = await fetch(arxivUrl).then(r => r.text());

function pickTag(text, tag) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}
function pickAll(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

const entry = pickTag(xml, 'entry');
if (!entry) {
  console.error('[ingest] no <entry> in arXiv response — invalid arxivId?');
  process.exit(1);
}
const title = (pickTag(entry, 'title') ?? '').replace(/\s+/g, ' ').trim();
const summary = (pickTag(entry, 'summary') ?? '').replace(/\s+/g, ' ').trim();
const published = pickTag(entry, 'published') ?? '';
const year = published ? Number(published.slice(0, 4)) : undefined;
const authorEntries = pickAll(entry, 'author');
const authors = authorEntries.map(a => pickTag(a, 'name')).filter(Boolean);

console.log('');
console.log('─── Paper ─────────────────────────────────────────────');
console.log(`title:    ${title}`);
console.log(`year:     ${year ?? '?'}`);
console.log(`authors:  ${authors.join(', ')}`);
console.log(`abstract: ${summary.slice(0, 300)}${summary.length > 300 ? '…' : ''}`);
console.log('───────────────────────────────────────────────────────');

// ── Closure overlap analysis (optional) ──
const anchor = flags.anchor;
if (anchor) {
  const node = graph.nodes.find(n => n.id === anchor);
  if (!node) {
    console.error(`[ingest] anchor topic not found in graph: ${anchor}`);
    process.exit(1);
  }
  const candidateClosure = new Set([anchor, ...node.ancestors]);
  const mvpClosure = new Set(graph.nodes.map(n => n.id));

  const overlap = [...candidateClosure].filter(id => mvpClosure.has(id));
  const onlyInCandidate = [...candidateClosure].filter(id => !mvpClosure.has(id));

  console.log('');
  console.log('─── Closure overlap vs MVP ───────────────────────────');
  console.log(`anchor closure:  ${candidateClosure.size}`);
  console.log(`current MVP:     ${mvpClosure.size}`);
  console.log(`overlap:         ${overlap.length}`);
  console.log(`would add:       ${onlyInCandidate.length}`);
  if (onlyInCandidate.length) {
    for (const id of onlyInCandidate) console.log(`  + ${id}`);
  }
  console.log('───────────────────────────────────────────────────────');
}

// ── Author key suggestions ──
function authorKey(name, year) {
  const last = name.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, '') ?? 'unknown';
  return `${last}-${year ?? 'na'}`;
}

console.log('');
console.log('─── Suggested authors.yml entries ─────────────────────');
for (const a of authors) {
  const key = authorKey(a, year);
  console.log(`${key}:`);
  console.log(`  name: ${a}`);
  console.log(`  orcid: ~`);
  console.log(`  affiliation: ~`);
  console.log(`  contact: { scholar: ~, email: ~ }`);
}
console.log('───────────────────────────────────────────────────────');

// ── Suggested sources frontmatter block ──
const authorKeys = authors.map(a => authorKey(a, year));
console.log('');
console.log('─── Paste into topic frontmatter ──────────────────────');
console.log('sources:');
console.log(`  - type: paper`);
console.log(`    title: "${title.replace(/"/g, '\\"')}"`);
console.log(`    authors: [${authorKeys.join(', ')}]`);
if (year !== undefined) console.log(`    year: ${year}`);
console.log(`    arxiv: "${arxivId}"`);
console.log(`    role: primary`);
console.log('───────────────────────────────────────────────────────');
