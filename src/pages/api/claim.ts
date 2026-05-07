import type { APIRoute } from 'astro';
import { SESSION_COOKIE, verifySession } from '../../lib/server/jwt';
import {
  findAuthorByOrcid,
  readReviewers,
  readTopic,
  topicCitesAuthorKey,
} from '../../lib/server/registry';
import {
  commitFile,
  createBranch,
  getBranchSha,
  getDefaultBranch,
  getFileOnBranch,
  openPullRequest,
  safeBranchFrag,
} from '../../lib/server/repo-content';
import { GITHUB_LABELS } from '../../lib/server/github-app';
import { clientIp, getLimiter } from '../../lib/server/rate-limit';

export const prerender = false;

type ClaimBody = {
  topicId: string;
  /** Optional: caller's preferred GitHub handle. We don't verify it — maintainers do during PR review. */
  github?: string;
  /** Optional short note to include in the PR body. */
  note?: string;
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function determineTier(topicId: string): 'foundation' | 'field' | 'frontier' {
  return readTopic(topicId)?.reviewTier ?? 'field';
}

function appendReviewerYaml(existing: string, entry: {
  github: string;
  orcid: string;
  name: string;
  expertise: string[];
  tier: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const expertise = entry.expertise.map(e => `    - ${e}`).join('\n');
  const block = [
    '',
    `- github: ${entry.github}`,
    `  orcid: ${entry.orcid}`,
    `  name: ${JSON.stringify(entry.name)}`,
    `  expertise:`,
    expertise,
    `  tier: ${entry.tier}`,
    `  verifiedBy: orcid-oauth`,
    `  verifiedAt: '${today}'`,
    '',
  ].join('\n');
  // Trim trailing whitespace/newlines, then append.
  const base = existing.replace(/\s+$/, '');
  return `${base}\n${block}`;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionCookie = cookies.get(SESSION_COOKIE.name)?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;
  if (!session) return json(401, { error: 'Sign in with ORCID first' });

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!body || typeof body.topicId !== 'string') return json(400, { error: 'Missing topicId' });

  const topic = readTopic(body.topicId);
  if (!topic) return json(404, { error: 'Unknown topic' });

  // Verify ORCID matches an author cited on the topic.
  const author = findAuthorByOrcid(session.orcid);
  if (!author) {
    return json(403, {
      error: 'Your ORCID is not linked to any cited author. Add yourself to authors.yml via PR first, or contact a maintainer.',
    });
  }
  if (!topicCitesAuthorKey(body.topicId, author.key)) {
    return json(403, { error: 'Your ORCID is not cited on this topic.' });
  }

  // Already claimed?
  const reviewers = readReviewers();
  const already = reviewers.find(r => r.orcid === session.orcid);
  if (already && already.expertise.includes(body.topicId)) {
    return json(409, { error: 'You are already a reviewer for this topic.' });
  }

  if (body.github && !/^[A-Za-z0-9-]{1,39}$/.test(body.github)) {
    return json(400, { error: 'Invalid GitHub handle' });
  }
  if (body.note && body.note.length > 1000) return json(400, { error: 'Note too long' });

  const ip = clientIp(request);
  const rl = await getLimiter().check(`claim:${ip}`);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) },
    });
  }

  // Build the PR.
  const githubHandle = body.github?.trim() || `orcid-${session.orcid.replace(/-/g, '')}`;
  const tier = determineTier(body.topicId);
  const expertise = already ? Array.from(new Set([...already.expertise, body.topicId])) : [body.topicId];

  try {
    // Branch from default branch.
    const base = await getDefaultBranch();
    const baseSha = await getBranchSha(base);
    const ts = Date.now().toString(36);
    const branch = `claim/${safeBranchFrag(body.topicId)}-${safeBranchFrag(githubHandle)}-${ts}`;
    await createBranch(branch, baseSha);

    // Update reviewers.yml on the new branch.
    const file = await getFileOnBranch('reviewers.yml', branch);
    let updated: string;
    if (already) {
      updated = upsertReviewerExpertise(file.content, session.orcid, body.topicId);
    } else {
      updated = appendReviewerYaml(file.content, {
        github: githubHandle,
        orcid: session.orcid,
        name: author.name,
        expertise,
        tier,
      });
    }
    await commitFile({
      path: 'reviewers.yml',
      branch,
      content: updated,
      message: `Add ORCID-verified reviewer ${session.orcid} for ${body.topicId}`,
      sha: file.sha,
    });

    const prTitle = `Claim: ${author.name} for \`${body.topicId}\``;
    const prBody = [
      `**ORCID-verified author claim.** This PR adds an entry to \`reviewers.yml\` after the claimant signed in with ORCID and \`authors.yml\` confirms they are cited on the topic.`,
      '',
      `- **Topic:** [\`${body.topicId}\`](https://charted.science/${body.topicId})`,
      `- **ORCID:** [\`${session.orcid}\`](https://orcid.org/${session.orcid})`,
      `- **Name:** ${author.name}`,
      `- **Author key in \`authors.yml\`:** \`${author.key}\``,
      `- **Tier (auto):** \`${tier}\``,
      body.github ? `- **GitHub handle (claimed):** \`@${body.github}\`` : '- **GitHub handle:** _placeholder_; reviewer can edit before merge.',
      '',
      body.note ? `> ${body.note.replace(/\n/g, '\n> ')}` : '',
      '',
      '<sub>Submitted via the in-page Claim Authorship widget on charted.science.</sub>',
    ]
      .filter(Boolean)
      .join('\n');

    const pr = await openPullRequest({
      head: branch,
      base,
      title: prTitle,
      body: prBody,
      labels: [GITHUB_LABELS.claim],
    });

    return json(201, { prUrl: pr.html_url, prNumber: pr.number });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isConfig = /Missing required env var/.test(message);
    return json(isConfig ? 503 : 502, {
      error: isConfig ? 'GitHub integration not configured' : 'Could not open claim PR',
      detail: message,
    });
  }
};

/**
 * Add a topic ID to an existing reviewer's `expertise` list, in place.
 *
 * Naive YAML-text-rewrite (we don't want to round-trip through a YAML parser
 * and lose comments). Looks for the reviewer's `orcid:` line, walks back to
 * the entry's `- github:` anchor, then walks forward until it finds the
 * `expertise:` block and appends a new item before the next sibling key.
 */
function upsertReviewerExpertise(content: string, orcid: string, newTopicId: string): string {
  const lines = content.split('\n');
  const orcidLineIdx = lines.findIndex(l => l.match(new RegExp(`^\\s*orcid:\\s*${orcid}\\s*$`)));
  if (orcidLineIdx === -1) return content;
  // Find expertise block within the same entry.
  let i = orcidLineIdx + 1;
  while (i < lines.length && !/^\s*expertise:\s*$/.test(lines[i])) {
    if (/^- /.test(lines[i])) return content; // ran into next entry without expertise
    i++;
  }
  if (i >= lines.length) return content;
  // Walk past existing expertise items to find insertion point.
  let j = i + 1;
  const itemRe = /^\s+-\s+/;
  while (j < lines.length && itemRe.test(lines[j])) j++;
  const indent = lines[i].match(/^\s*/)?.[0] ?? '';
  lines.splice(j, 0, `${indent}  - ${newTopicId}`);
  return lines.join('\n');
}
