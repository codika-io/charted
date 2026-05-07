import type { APIRoute } from 'astro';
import { buildAuthorizeUrl } from '../../../lib/server/orcid';
import { isProd } from '../../../lib/server/env';
import { ORCID_RETURN_COOKIE, ORCID_STATE_COOKIE } from '../../../lib/server/orcid-cookies';

export const prerender = false;

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const state = randomState();
  const returnTo = url.searchParams.get('returnTo') ?? '/';
  // Only allow same-site relative returnTo to prevent open-redirect.
  const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const html = `<!doctype html><html><body><h1>ORCID sign-in unavailable</h1><p>${message}</p><p><a href="/">Return home</a></p></body></html>`;
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  cookies.set(ORCID_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  cookies.set(ORCID_RETURN_COOKIE, safeReturn, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return redirect(authorizeUrl, 302);
};
