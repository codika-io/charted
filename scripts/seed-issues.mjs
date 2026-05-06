#!/usr/bin/env node
/**
 * One-time seed: create a GitHub issue per non-archived topic so each
 * topic has a "working on it" surface, and write the issue number back
 * into the topic's frontmatter (`reviewIssue`).
 *
 * After this runs once, issues are managed by hand on GitHub. Re-running
 * is safe: topics that already have a `reviewIssue` are skipped.
 *
 * Requires `gh` CLI authenticated against the target repo.
 *
 *   npm run seed:issues -- [--repo codika-io/charted] [--dry-run]
 *
 * Defaults to a dry-run printing the issues that would be created.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOPICS_DIR = join(ROOT, 'src', 'content', 'topics');

function parseArgs(argv) {
  const out = { flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.flags[a.slice(2)] = next;
        i++;
      } else {
        out.flags[a.slice(2)] = true;
      }
    }
  }
  return out;
}

const { flags } = parseArgs(process.argv.slice(2));
const repo = flags.repo ?? 'codika-io/charted';
const dryRun = flags['dry-run'] !== false; // default to true unless --dry-run false

if (dryRun) {
  console.log(`[seed-issues] DRY RUN (pass --dry-run false to actually create issues on ${repo})`);
}

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

function ghIssueCreate(title, body, labels) {
  const labelArgs = labels.map(l => `--label ${JSON.stringify(l)}`).join(' ');
  const cmd = `gh issue create --repo ${repo} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} ${labelArgs}`;
  const out = execSync(cmd, { encoding: 'utf8' }).trim();
  // gh prints the URL of the new issue; extract the trailing number
  const m = out.match(/\/issues\/(\d+)\s*$/);
  if (!m) throw new Error(`could not parse issue number from gh output: ${out}`);
  return Number(m[1]);
}

let created = 0;
let skipped = 0;
let wouldCreate = 0;

for (const file of walk(TOPICS_DIR)) {
  const id = topicIdFromPath(file);
  const raw = readFileSync(file, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data;

  if (data.status === 'archived') continue;
  if (data.reviewIssue) {
    skipped++;
    continue;
  }

  const tier = data.reviewTier ?? 'foundation';
  const status = data.status ?? 'stub';
  const branch = id.split('/')[0];

  const title = `[topic] ${data.title}`;
  const body = [
    `Tracking review for **${data.title}** (\`${id}\`).`,
    '',
    `- **Status:** \`${status}\``,
    `- **Tier:** \`${tier}\``,
    `- **Page:** https://charted.science/${id}`,
    '',
    'Comment here to claim, ask questions, or propose edits. PRs that touch this topic should reference this issue with `Closes #N`.',
  ].join('\n');
  const labels = [`tier:${tier}`, `status:${status}`, `branch:${branch}`];

  if (dryRun) {
    console.log(`[would create] ${title} ${labels.map(l => `[${l}]`).join(' ')}`);
    wouldCreate++;
    continue;
  }

  const issue = ghIssueCreate(title, body, labels);
  parsed.data.reviewIssue = issue;
  writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  console.log(`[created] #${issue} ${title}`);
  created++;
}

console.log('');
console.log('─── Summary ──────────────────────────────────────────');
if (dryRun) {
  console.log(`would create: ${wouldCreate}`);
  console.log(`already had reviewIssue (skipped): ${skipped}`);
} else {
  console.log(`created: ${created}`);
  console.log(`already had reviewIssue (skipped): ${skipped}`);
}
console.log('──────────────────────────────────────────────────────');
