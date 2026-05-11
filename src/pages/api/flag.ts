import type { APIRoute } from 'astro';
import { getOctokit, repoCoords, GITHUB_LABELS } from '../../lib/server/github-app';
import { clientIp, getLimiter } from '../../lib/server/rate-limit';
import { topicExists } from '../../lib/server/registry';
import { verifySession } from '../../lib/server/jwt';
import { SESSION_COOKIE } from '../../lib/server/jwt';

export const prerender = false;

const KIND_LABELS: Record<string, string> = {
  'wrong-prereq': 'flag/wrong-prereq',
  'missing-prereq': 'flag/missing-prereq',
  'wrong-direction': 'flag/wrong-direction',
  'factual-error': 'flag/factual-error',
  'source-issue': 'flag/source-issue',
  other: 'flag/other',
};

type FlagBody = {
  topicId: string;
  kind: keyof typeof KIND_LABELS;
  context?: string; // e.g. "edge: linear-algebra → self-attention" or "section: Transformers"
  comment: string;
  reporterEmail?: string;
};

function badRequest(message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tooMany(retryAfter: number) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: FlagBody;
  try {
    body = (await request.json()) as FlagBody;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body.topicId !== 'string' || !topicExists(body.topicId)) {
    return badRequest('Unknown topic');
  }
  if (typeof body.kind !== 'string' || !(body.kind in KIND_LABELS)) {
    return badRequest('Invalid flag kind');
  }
  if (typeof body.comment !== 'string' || body.comment.trim().length < 5 || body.comment.length > 4000) {
    return badRequest('Comment must be between 5 and 4000 characters');
  }
  if (body.context && (typeof body.context !== 'string' || body.context.length > 500)) {
    return badRequest('Context too long');
  }
  if (body.reporterEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.reporterEmail)) {
    return badRequest('Invalid reporter email');
  }

  // Rate-limit by IP first; ORCID-authed users get a separate, more generous bucket later if needed.
  const ip = clientIp(request);
  const rl = await getLimiter().check(`flag:${ip}`);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  // Optional ORCID identity
  const sessionCookie = cookies.get(SESSION_COOKIE.name)?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;

  const reporterLine = session?.orcid
    ? `**Reporter (verified):** ${session.name ?? 'Anonymous'} — ORCID \`${session.orcid}\``
    : body.reporterEmail
      ? `**Reporter (unverified):** ${body.reporterEmail}`
      : `**Reporter:** anonymous`;

  const issueTitle = `[flag] ${body.kind} — ${body.topicId}`;
  const issueBody = [
    `**Topic:** \`${body.topicId}\` — https://charted.science/${body.topicId}`,
    `**Kind:** \`${body.kind}\``,
    body.context ? `**Context:** ${body.context}` : null,
    reporterLine,
    '',
    '---',
    '',
    body.comment.trim(),
    '',
    '<sub>Submitted via the in-page flag widget on charted.science.</sub>',
  ]
    .filter(Boolean)
    .join('\n');

  // GitHub label names are capped at 50 characters and reject many separators.
  // We only attach short, well-known labels (the flag-from-reviewer marker plus
  // the kind label) — the full topic path lives in the title and body, which
  // is enough for triage. Adding labels is also non-fatal: missing labels in
  // the repo shouldn't kill the whole submission.
  const labels = [GITHUB_LABELS.flag, KIND_LABELS[body.kind]];

  let issueUrl: string;
  let issueNumber: number;
  try {
    const octo = getOctokit();
    const { owner, repo } = repoCoords();
    const created = await octo.issues.create({ owner, repo, title: issueTitle, body: issueBody });
    issueUrl = created.data.html_url;
    issueNumber = created.data.number;
    // Attempt to label after creation; swallow label-only failures so a missing
    // label in the repo doesn't surface as "GitHub issue creation failed" to
    // the reviewer who actually got an issue opened.
    try {
      await octo.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
    } catch {
      /* labels are nice-to-have, not required for the flag to be actionable */
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isConfig = /Missing required env var/.test(message);
    return new Response(JSON.stringify({ error: isConfig ? 'GitHub integration not configured' : 'GitHub issue creation failed', detail: message }), {
      status: isConfig ? 503 : 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ issueUrl, issueNumber }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
