import { ORCID_ENV, getRequired } from './env';

/**
 * Public ORCID OAuth helpers. We only ever request the `/authenticate` scope —
 * enough to verify the user controls an ORCID iD, nothing more.
 *
 * Spec: https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/
 */

export const ORCID_SCOPE = '/authenticate';

export type OrcidTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  name?: string;
  /** ORCID iD, e.g. "0000-0001-2345-6789" */
  orcid: string;
};

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(`${ORCID_ENV.authBase()}/oauth/authorize`);
  url.searchParams.set('client_id', getRequired('ORCID_CLIENT_ID'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ORCID_SCOPE);
  url.searchParams.set('redirect_uri', getRequired('ORCID_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(code: string): Promise<OrcidTokenResponse> {
  const body = new URLSearchParams({
    client_id: getRequired('ORCID_CLIENT_ID'),
    client_secret: getRequired('ORCID_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRequired('ORCID_REDIRECT_URI'),
  });
  const res = await fetch(`${ORCID_ENV.authBase()}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ORCID token exchange failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as OrcidTokenResponse;
}

/** Strict ORCID iD format validator. */
export function isValidOrcid(id: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id);
}
