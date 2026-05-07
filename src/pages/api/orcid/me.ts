import type { APIRoute } from 'astro';
import { SESSION_COOKIE, verifySession } from '../../../lib/server/jwt';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const value = cookies.get(SESSION_COOKIE.name)?.value;
  const session = value ? await verifySession(value) : null;
  return new Response(JSON.stringify({ session }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
