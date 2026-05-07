import { getOctokit, repoCoords } from './github-app';

/**
 * Helpers around GitHub Contents API to read/write files on a branch and
 * raise a PR. We never mutate the local working tree — main is the source
 * of truth, every change goes through a PR.
 */

export async function getDefaultBranch(): Promise<string> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  const r = await octo.repos.get({ owner, repo });
  return r.data.default_branch;
}

export async function getBranchSha(branch: string): Promise<string> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  const r = await octo.git.getRef({ owner, repo, ref: `heads/${branch}` });
  return r.data.object.sha;
}

export async function createBranch(newBranch: string, fromSha: string): Promise<void> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  await octo.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: fromSha });
}

export async function getFileOnBranch(
  path: string,
  branch: string,
): Promise<{ content: string; sha: string }> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  const r = await octo.repos.getContent({ owner, repo, path, ref: branch });
  if (Array.isArray(r.data) || r.data.type !== 'file') {
    throw new Error(`Expected file at ${path}, got ${Array.isArray(r.data) ? 'directory' : r.data.type}`);
  }
  // r.data.content is base64-encoded
  const content = Buffer.from(r.data.content, 'base64').toString('utf8');
  return { content, sha: r.data.sha };
}

export async function commitFile(opts: {
  path: string;
  branch: string;
  content: string;
  message: string;
  sha?: string;
}): Promise<void> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  await octo.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: opts.path,
    branch: opts.branch,
    message: opts.message,
    content: Buffer.from(opts.content, 'utf8').toString('base64'),
    sha: opts.sha,
  });
}

export async function openPullRequest(opts: {
  head: string;
  base: string;
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ number: number; html_url: string }> {
  const octo = getOctokit();
  const { owner, repo } = repoCoords();
  const pr = await octo.pulls.create({
    owner,
    repo,
    head: opts.head,
    base: opts.base,
    title: opts.title,
    body: opts.body,
  });
  if (opts.labels?.length) {
    try {
      await octo.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: opts.labels });
    } catch {
      // Labels are nice-to-have; missing labels in the repo shouldn't fail the claim.
    }
  }
  return { number: pr.data.number, html_url: pr.data.html_url };
}

/**
 * Slug-safe branch fragment from a string (lowercased, alnum + dashes only).
 * Truncated to keep ref names sane.
 */
export function safeBranchFrag(input: string, max = 60): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}
