import type { APIRoute } from 'astro';
import { exchangeCode, isValidOrcid } from '../../../lib/server/orcid';
import { signSession, SESSION_COOKIE, sessionCookieAttrs } from '../../../lib/server/jwt';
import { isProd } from '../../../lib/server/env';
import { ORCID_RETURN_COOKIE, ORCID_STATE_COOKIE } from '../../../lib/server/orcid-cookies';

export const prerender = false;

function errorResponse(status: number, message: string) {
  return new Response(
    `<!doctype html><html><body><h1>ORCID sign-in failed</h1><p>${message}</p><p><a href="/">Return home</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return errorResponse(400, `ORCID returned an error: ${error}`);
  if (!code || !state) return errorResponse(400, 'Missing code or state.');

  const expectedState = cookies.get(ORCID_STATE_COOKIE)?.value;
  const returnTo = cookies.get(ORCID_RETURN_COOKIE)?.value ?? '/';
  cookies.delete(ORCID_STATE_COOKIE, { path: '/' });
  cookies.delete(ORCID_RETURN_COOKIE, { path: '/' });

  if (!expectedState || expectedState !== state) {
    return errorResponse(400, 'Invalid state — please try again.');
  }

  let token;
  try {
    token = await exchangeCode(code);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return errorResponse(502, `Could not exchange code with ORCID. ${detail}`);
  }

  if (!isValidOrcid(token.orcid)) return errorResponse(400, 'ORCID returned an unrecognized iD.');

  const jwt = await signSession({ orcid: token.orcid, name: token.name });
  cookies.set(SESSION_COOKIE.name, jwt, sessionCookieAttrs({ secure: isProd() }));

  const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return redirect(safeReturn, 302);
};
