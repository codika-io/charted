#!/usr/bin/env node
/**
 * Phase G scripted graph checks.
 *
 * Asserts that the merged tree is structurally sound:
 *   1. Every parent: in frontmatter resolves to an existing topic or to a branch root.
 *   2. Every prerequisites[] id resolves to an existing topic.
 *   3. Every sources[].authors[] key resolves in authors.yml.
 *   4. Every protected topic_id (loaded from the run folder) exists on disk.
 *   5. No two MDX files map to the same topic_id (no <id>.mdx + <id>/index.mdx collision).
 *
 * Writes a JSON report to .docs/runs/2026-05-12-full-mapping/phase-g/checks.json.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOPICS_DIR = join(ROOT, 'src', 'content', 'topics');
const AUTHORS_FILE = join(ROOT, 'authors.yml');
const PROTECTED_FILE = join(ROOT, '.docs', 'runs', '2026-05-12-full-mapping', 'protected-slugs.json');
const OUT_DIR = join(ROOT, '.docs', 'runs', '2026-05-12-full-mapping', 'phase-g');

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

const topics = new Map();         // id -> frontmatter
const pathById = new Map();       // id -> absPath
const duplicates = [];

for (const file of walk(TOPICS_DIR)) {
  const id = topicIdFromPath(file);
  if (topics.has(id)) {
    duplicates.push({ id, paths: [pathById.get(id), file] });
    continue;
  }
  const { data } = matter(readFileSync(file, 'utf8'));
  topics.set(id, data);
  pathById.set(id, file);
}

const authors = parseYaml(readFileSync(AUTHORS_FILE, 'utf8')) ?? {};
const authorKeys = new Set(Object.keys(authors));

const BRANCH_ROOTS = new Set(['physics', 'computer-science', 'mathematics', 'chemistry', 'biology']);

const parentUnknown = [];
const prereqUnknown = [];
const authorUnknown = [];

for (const [id, data] of topics) {
  if (data.parent && !topics.has(data.parent) && !BRANCH_ROOTS.has(data.parent)) {
    parentUnknown.push({ id, parent: data.parent });
  }
  for (const p of data.prerequisites ?? []) {
    if (!topics.has(p) && !BRANCH_ROOTS.has(p)) {
      prereqUnknown.push({ id, missing_prereq: p });
    }
  }
  for (const s of data.sources ?? []) {
    for (const ak of s.authors ?? []) {
      if (!authorKeys.has(ak)) {
        authorUnknown.push({ id, missing_author: ak, source: s.title });
      }
    }
  }
}

const protected_ = JSON.parse(readFileSync(PROTECTED_FILE, 'utf8'));
const PROTECTED_IDS = protected_.protected_topic_ids;
const protectedMissingOnDisk = PROTECTED_IDS.filter(id => !topics.has(id));

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    topics: topics.size,
    authors: authorKeys.size,
    protected_ids: PROTECTED_IDS.length,
  },
  checks: {
    duplicates_on_disk: duplicates.length,
    parent_unknown:     parentUnknown.length,
    prereq_unknown:     prereqUnknown.length,
    author_unknown:     authorUnknown.length,
    protected_missing:  protectedMissingOnDisk.length,
  },
  details: {
    duplicates: duplicates.slice(0, 20),
    parent_unknown_sample: parentUnknown.slice(0, 20),
    prereq_unknown_sample: prereqUnknown.slice(0, 20),
    author_unknown_sample: authorUnknown.slice(0, 20),
    protected_missing: protectedMissingOnDisk,
  },
};

const allPassed =
  report.checks.duplicates_on_disk === 0 &&
  report.checks.parent_unknown     === 0 &&
  report.checks.prereq_unknown     === 0 &&
  report.checks.author_unknown     === 0 &&
  report.checks.protected_missing  === 0;

report.passed = allPassed;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'checks.json'), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
process.exit(allPassed ? 0 : 1);
