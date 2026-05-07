#!/usr/bin/env node
/**
 * Wave sourcing — for a single seed topic, pull paper candidates from OpenAlex,
 * apply the filters we agreed on, resolve first-author info (h-index, ORCID,
 * affiliation), and emit a JSON candidate list.
 *
 * Filters (locked-in for v1):
 *   - publication_date ≥ 3 years ago
 *   - 10 ≤ cited_by_count ≤ 300
 *   - first-author h-index < 15
 *   - first author within 8 years of first publication
 *   - matches the seed topic's OpenAlex concept tag
 *
 * Out:  writes the JSON list to .docs/waves/<wave-id>/<seed-slug>.candidates.json
 *
 * Usage:  node scripts/source-wave.mjs <seed-topic-id> [openalex-concept-id] [limit]
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAILTO = 'tools@codika.io'; // OpenAlex polite pool

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: source-wave.mjs <seed-topic-id> <openalex-concept-id> [limit=50]');
  process.exit(1);
}
const [seed, conceptId, limitArg] = args;
const fetchLimit = Number(limitArg ?? 50);

const fromDate = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
})();

const work = new URL('https://api.openalex.org/works');
work.searchParams.set('filter', [
  `concepts.id:${conceptId}`,
  `from_publication_date:${fromDate}`,
  'cited_by_count:>9',
  'cited_by_count:<300',
  'type:article',
  'has_abstract:true',
].join(','));
work.searchParams.set('per-page', '200');
work.searchParams.set('sort', 'cited_by_count:desc');
work.searchParams.set('mailto', MAILTO);

console.error(`[source-wave] querying OpenAlex for ${seed} (concept=${conceptId})…`);
const r = await fetch(work);
if (!r.ok) {
  console.error('[source-wave] OpenAlex error:', r.status, await r.text());
  process.exit(1);
}
const payload = await r.json();
const works = payload.results;
console.error(`[source-wave] got ${works.length} raw candidates, filtering…`);

function reconstructAbstract(inv) {
  if (!inv) return '';
  const positions = [];
  for (const [word, idxs] of Object.entries(inv)) for (const i of idxs) positions[i] = word;
  return positions.join(' ');
}

async function fetchAuthor(authorId) {
  if (!authorId) return null;
  const id = authorId.split('/').pop();
  const r = await fetch(`https://api.openalex.org/authors/${id}?mailto=${MAILTO}`);
  if (!r.ok) return null;
  return r.json();
}

const accepted = [];
let scanned = 0;
for (const w of works) {
  scanned++;
  const firstAuth = w.authorships?.find(a => a.author_position === 'first');
  if (!firstAuth?.author?.id) continue;

  const author = await fetchAuthor(firstAuth.author.id);
  if (!author) continue;

  const h = author.summary_stats?.h_index ?? 999;
  // Years since first publication
  const counts = author.counts_by_year ?? [];
  const firstPubYear = counts.length ? Math.min(...counts.map(c => c.year)) : new Date().getFullYear();
  const yearsActive = new Date().getFullYear() - firstPubYear;

  if (h >= 15) continue;
  if (yearsActive > 8) continue;

  accepted.push({
    paper: {
      id: w.id,
      title: w.title,
      year: w.publication_year,
      cites: w.cited_by_count,
      type: w.type,
      doi: w.doi,
      arxiv: w.locations?.find(l => /arxiv/i.test(l.source?.display_name || ''))?.landing_page_url,
      url: w.primary_location?.landing_page_url,
      venue: w.primary_location?.source?.display_name,
      isOpenAccess: w.open_access?.is_oa ?? false,
      pdfUrl: w.best_oa_location?.pdf_url ?? w.primary_location?.pdf_url ?? null,
      abstract: reconstructAbstract(w.abstract_inverted_index),
      concepts: w.concepts.slice(0, 6).map(c => ({ id: c.id, name: c.display_name, score: c.score, level: c.level })),
      coauthorCount: w.authorships?.length ?? 0,
    },
    firstAuthor: {
      openalexId: author.id,
      name: author.display_name,
      orcid: author.orcid ?? null,
      hIndex: h,
      worksCount: author.works_count,
      yearsActive,
      affiliation: firstAuth.institutions?.[0]?.display_name ?? null,
      affiliationCountry: firstAuth.institutions?.[0]?.country_code ?? null,
    },
  });
  if (accepted.length >= fetchLimit) break;
}

console.error(`[source-wave] ${accepted.length} accepted from ${scanned} scanned`);

const outDir = join(ROOT, '.docs', 'waves', new Date().toISOString().slice(0, 10));
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${seed.replace(/\//g, '__')}.candidates.json`);
writeFileSync(
  outFile,
  JSON.stringify({ seed, conceptId, generatedAt: new Date().toISOString(), count: accepted.length, candidates: accepted }, null, 2),
);
console.error(`[source-wave] wrote ${outFile}`);
