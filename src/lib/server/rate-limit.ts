import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getOptional } from './env';

/**
 * Rate limiter backed by Upstash Redis when configured, with an in-memory
 * fallback for local dev. The fallback is per-process and resets on restart —
 * fine for development, never for production.
 */

type Limiter = {
  check(key: string): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }>;
};

let limiterInstance: Limiter | null = null;

function buildUpstashLimiter(redisUrl: string, redisToken: string): Limiter {
  const redis = new Redis({ url: redisUrl, token: redisToken });
  // 5 requests per IP per minute, sliding window.
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: false,
    prefix: 'charted:rl',
  });
  return {
    async check(key: string) {
      const r = await rl.limit(key);
      if (r.success) return { ok: true } as const;
      const retryAfterSeconds = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
      return { ok: false, retryAfterSeconds } as const;
    },
  };
}

function buildMemoryLimiter(): Limiter {
  const buckets = new Map<string, number[]>();
  const limit = 5;
  const windowMs = 60_000;
  return {
    async check(key: string) {
      const now = Date.now();
      const arr = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
      if (arr.length >= limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - arr[0])) / 1000));
        buckets.set(key, arr);
        return { ok: false, retryAfterSeconds } as const;
      }
      arr.push(now);
      buckets.set(key, arr);
      return { ok: true } as const;
    },
  };
}

export function getLimiter(): Limiter {
  if (limiterInstance) return limiterInstance;
  // Vercel's Upstash for Redis integration injects KV_REST_API_* names;
  // a standalone Upstash setup uses UPSTASH_REDIS_REST_*. Support both.
  const url = getOptional('KV_REST_API_URL') ?? getOptional('UPSTASH_REDIS_REST_URL');
  const token = getOptional('KV_REST_API_TOKEN') ?? getOptional('UPSTASH_REDIS_REST_TOKEN');
  limiterInstance = url && token ? buildUpstashLimiter(url, token) : buildMemoryLimiter();
  return limiterInstance;
}

/** Best-effort client IP extraction for rate-limit keys. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
