/**
 * Server-side helpers to read authors.yml, reviewers.yml, and topic frontmatter
 * straight off disk. Used by /api/claim to verify ORCID-to-author matches and
 * to detect already-claimed reviewers without hitting GitHub.
 *
 * On Vercel, these files ship inside the function bundle since they live under
 * the project root. For mutations we go through the GitHub API on the live
 * `main` branch (see repo-content.ts) — never write back to local disk.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import matter from 'gray-matter';

const ROOT = process.cwd();
const TOPICS_DIR = join(ROOT, 'src', 'content', 'topics');
const AUTHORS_FILE = join(ROOT, 'authors.yml');
const REVIEWERS_FILE = join(ROOT, 'reviewers.yml');

export type AuthorEntry = {
  key: string;
  name: string;
  orcid?: string;
  affiliation?: string;
  contact?: { email?: string; scholar?: string; linkedin?: string };
};

export type ReviewerEntry = {
  github: string;
  name: string;
  orcid?: string;
  expertise: string[];
  tier: 'foundation' | 'field' | 'frontier';
};

export function readAuthors(): AuthorEntry[] {
  if (!existsSync(AUTHORS_FILE)) return [];
  const raw = readFileSync(AUTHORS_FILE, 'utf8');
  const data = parseYaml(raw) as Record<string, Omit<AuthorEntry, 'key'>> | null;
  if (!data) return [];
  return Object.entries(data).map(([key, v]) => ({ key, ...v }));
}

export function readReviewers(): ReviewerEntry[] {
  if (!existsSync(REVIEWERS_FILE)) return [];
  const raw = readFileSync(REVIEWERS_FILE, 'utf8');
  const data = parseYaml(raw);
  return Array.isArray(data) ? (data as ReviewerEntry[]) : [];
}

export type TopicSourceRef = {
  title: string;
  authors: string[]; // keys from authors.yml
};

export type TopicMeta = {
  id: string;
  title: string;
  reviewTier: 'foundation' | 'field' | 'frontier';
  sources: TopicSourceRef[];
};

export function readTopic(id: string): TopicMeta | null {
  const direct = join(TOPICS_DIR, `${id}.mdx`);
  const indexed = join(TOPICS_DIR, id, 'index.mdx');
  const file = existsSync(direct) ? direct : existsSync(indexed) ? indexed : null;
  if (!file) return null;
  const { data } = matter(readFileSync(file, 'utf8'));
  const tier =
    data.reviewTier === 'foundation' || data.reviewTier === 'field' || data.reviewTier === 'frontier'
      ? data.reviewTier
      : 'foundation';
  return {
    id,
    title: data.title ?? id,
    reviewTier: tier,
    sources: Array.isArray(data.sources)
      ? data.sources.map((s: { title: string; authors?: string[] }) => ({
          title: s.title,
          authors: Array.isArray(s.authors) ? s.authors : [],
        }))
      : [],
  };
}

export function findAuthorByOrcid(orcid: string): AuthorEntry | undefined {
  return readAuthors().find(a => a.orcid && a.orcid === orcid);
}

/** Whether a topic exists at all (validates flag/claim payloads). */
export function topicExists(id: string): boolean {
  return readTopic(id) !== null;
}

export function topicCitesAuthorKey(topicId: string, authorKey: string): boolean {
  const t = readTopic(topicId);
  if (!t) return false;
  return t.sources.some(s => s.authors.includes(authorKey));
}
