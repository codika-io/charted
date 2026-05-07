import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/server/jwt';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE.name, { path: '/' });
  return redirect('/', 302);
};
