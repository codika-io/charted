import { SignJWT, jwtVerify } from 'jose';
import { getRequired } from './env';

export type SessionPayload = {
  /** ORCID iD (e.g. "0000-0001-2345-6789") */
  orcid: string;
  /** Display name returned by ORCID */
  name?: string;
};

const COOKIE_NAME = 'charted_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function key(): Uint8Array {
  return new TextEncoder().encode(getRequired('AUTH_JWT_SECRET'));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('charted')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: 'charted' });
    if (typeof payload.orcid !== 'string') return null;
    return { orcid: payload.orcid, name: typeof payload.name === 'string' ? payload.name : undefined };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  ttlSeconds: SESSION_TTL_SECONDS,
} as const;

/** Build the Set-Cookie value for the session cookie. */
export function sessionCookieAttrs(opts: { secure: boolean }): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return { httpOnly: true, secure: opts.secure, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS };
}
