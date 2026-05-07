import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getRequired } from './env';

/**
 * Cached installation-authenticated Octokit client for the Charted GitHub App.
 * The token has a ~60-minute lifetime; @octokit/auth-app refreshes it
 * transparently. We just keep one client per process.
 */
let cached: Octokit | null = null;

export function getOctokit(): Octokit {
  if (cached) return cached;

  const appId = getRequired('GITHUB_APP_ID');
  const installationId = Number(getRequired('GITHUB_APP_INSTALLATION_ID'));
  // Newlines in env vars are typically escaped as `\n` — restore them.
  const privateKey = getRequired('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');

  cached = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
    userAgent: 'charted-app',
  });
  return cached;
}

export function repoCoords() {
  return {
    owner: getRequired('GITHUB_REPO_OWNER'),
    repo: getRequired('GITHUB_REPO_NAME'),
  };
}

export const GITHUB_LABELS = {
  flag: 'flag/from-reviewer',
  claim: 'reviewer-claim',
} as const;
