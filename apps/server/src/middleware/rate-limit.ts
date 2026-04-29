import type { Env } from 'hono';
import { createMiddleware } from 'hono/factory';

/**
 * Simple in-memory sliding-window rate limiter for Hono.
 *
 * Tracks request counts per IP in a Map. Each client's window resets
 * after `windowMs`. Sets standard `X-RateLimit-*` headers on every
 * request. Returns 429 when the limit is exceeded.
 *
 * Per-isolate in Cloudflare Workers. For global rate limiting, use KV
 * or Durable Objects.
 *
 * @param limit - Maximum requests per window (default 100)
 * @param windowMs - Window duration in milliseconds (default 60000)
 */
export function rateLimit(limit = 100, windowMs = 60000) {
    const clients = new Map<string, { count: number; resetTime: number }>();

    return createMiddleware<Env>(async (c, next) => {
        const ip = c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'unknown';
        const now = Date.now();

        const client = clients.get(ip);

        if (!client || now > client.resetTime) {
            clients.set(ip, { count: 1, resetTime: now + windowMs });
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', String(limit - 1));
            c.header('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
            return await next();
        }

        if (client.count >= limit) {
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', '0');
            c.header('X-RateLimit-Reset', String(Math.ceil(client.resetTime / 1000)));
            return c.json({ error: 'Too many requests' }, 429);
        }

        client.count++;
        c.header('X-RateLimit-Limit', String(limit));
        c.header('X-RateLimit-Remaining', String(limit - client.count));
        c.header('X-RateLimit-Reset', String(Math.ceil(client.resetTime / 1000)));

        return await next();
    });
}
