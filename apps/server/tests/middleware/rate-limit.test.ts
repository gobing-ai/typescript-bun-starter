import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { rateLimit } from '../../src/middleware/rate-limit';

function createApp(limit: number, windowMs: number) {
    const app = new Hono();
    app.use('/rate-limited/*', rateLimit(limit, windowMs));
    app.get('/rate-limited/test', (c) => c.json({ ok: true }));
    return app;
}

describe('rateLimit middleware', () => {
    it('allows requests within the rate limit', async () => {
        const app = createApp(5, 60000);
        const res = await app.request('/rate-limited/test');
        expect(res.status).toBe(200);
    });

    it('sets X-RateLimit-* headers on allowed requests', async () => {
        const app = createApp(10, 60000);
        const res = await app.request('/rate-limited/test');
        expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
        expect(Number(res.headers.get('X-RateLimit-Remaining'))).toBeGreaterThan(0);
        expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull();
    });

    it('returns 429 when limit is exceeded', async () => {
        const app = createApp(2, 60000);

        await app.request('/rate-limited/test');
        await app.request('/rate-limited/test');

        const res = await app.request('/rate-limited/test');
        expect(res.status).toBe(429);

        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Too many requests');
    });

    it('resets after the window expires', async () => {
        const app = createApp(2, 50);

        await app.request('/rate-limited/test');
        await app.request('/rate-limited/test');

        const exceeded = await app.request('/rate-limited/test');
        expect(exceeded.status).toBe(429);

        await new Promise((resolve) => setTimeout(resolve, 60));

        const afterWindow = await app.request('/rate-limited/test');
        expect(afterWindow.status).toBe(200);
    });

    it('tracks IPs independently', async () => {
        const app = createApp(2, 60000);

        await app.request('/rate-limited/test', { headers: { 'x-forwarded-for': '10.0.0.1' } });
        await app.request('/rate-limited/test', { headers: { 'x-forwarded-for': '10.0.0.2' } });

        const res = await app.request('/rate-limited/test', { headers: { 'x-forwarded-for': '10.0.0.1' } });
        expect(res.status).toBe(200);
    });

    it('uses cf-connecting-ip header when x-forwarded-for is absent', async () => {
        const app = createApp(1, 60000);

        await app.request('/rate-limited/test', { headers: { 'cf-connecting-ip': 'cf-ip' } });

        const res = await app.request('/rate-limited/test', { headers: { 'cf-connecting-ip': 'cf-ip' } });
        expect(res.status).toBe(429);
    });

    it('uses "unknown" fallback when no IP headers are present', async () => {
        const app = createApp(1, 60000);

        await app.request('/rate-limited/test');

        const res = await app.request('/rate-limited/test');
        expect(res.status).toBe(429);
    });
});
