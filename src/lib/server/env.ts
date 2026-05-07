/**
 * Centralized server-side env access. Throws clearly when a required key is
 * missing so failures surface fast in dev rather than as cryptic 500s.
 */

const REQUIRED_FOR_GITHUB = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_INSTALLATION_ID',
  'GITHUB_REPO_OWNER',
  'GITHUB_REPO_NAME',
] as const;

const REQUIRED_FOR_ORCID = ['ORCID_CLIENT_ID', 'ORCID_CLIENT_SECRET', 'ORCID_REDIRECT_URI'] as const;

const REQUIRED_FOR_AUTH = ['AUTH_JWT_SECRET'] as const;

function read(key: string): string | undefined {
  // Astro exposes server env via process.env at runtime in Node/Vercel adapter.
  return process.env[key] ?? undefined;
}

export function getRequired(key: string): string {
  const v = read(key);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export function getOptional(key: string): string | undefined {
  return read(key);
}

export function assertGithubEnv() {
  for (const k of REQUIRED_FOR_GITHUB) getRequired(k);
}

export function assertOrcidEnv() {
  for (const k of REQUIRED_FOR_ORCID) getRequired(k);
}

export function assertAuthEnv() {
  for (const k of REQUIRED_FOR_AUTH) getRequired(k);
}

export const ORCID_ENV = {
  authBase: () => read('ORCID_AUTH_BASE') ?? 'https://orcid.org',
  apiBase: () => read('ORCID_API_BASE') ?? 'https://pub.orcid.org',
};

export function isProd(): boolean {
  return read('NODE_ENV') === 'production' || !!read('VERCEL');
}
