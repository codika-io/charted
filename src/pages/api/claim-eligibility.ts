import type { APIRoute } from 'astro';
import { SESSION_COOKIE, verifySession } from '../../lib/server/jwt';
import {
  findAuthorByOrcid,
  readReviewers,
  readTopic,
  topicCitesAuthorKey,
} from '../../lib/server/registry';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const topicId = url.searchParams.get('topicId') ?? '';
  if (!topicId || !readTopic(topicId)) {
    return new Response(JSON.stringify({ eligible: false, reason: 'unknown-topic' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookie = cookies.get(SESSION_COOKIE.name)?.value;
  const session = cookie ? await verifySession(cookie) : null;
  if (!session) {
    return new Response(JSON.stringify({ eligible: false, reason: 'no-session' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  const author = findAuthorByOrcid(session.orcid);
  if (!author) {
    return new Response(JSON.stringify({ eligible: false, reason: 'orcid-not-in-authors', session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }
  if (!topicCitesAuthorKey(topicId, author.key)) {
    return new Response(JSON.stringify({ eligible: false, reason: 'not-cited-here', session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }
  const already = readReviewers().some(r => r.orcid === session.orcid && r.expertise.includes(topicId));
  if (already) {
    return new Response(JSON.stringify({ eligible: false, reason: 'already-reviewer', session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  return new Response(JSON.stringify({ eligible: true, authorName: author.name, session }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
