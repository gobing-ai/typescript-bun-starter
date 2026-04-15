import { describe, expect, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../../src/middleware/auth';

describe('authMiddleware', () => {
    test('skips auth when API_KEY env is not set', async () => {
        const originalKey = process.env.API_KEY;
        delete process.env.API_KEY;

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);

        process.env.API_KEY = originalKey;
    });

    test('allows request with valid X-API-Key header', async () => {
        process.env.API_KEY = 'test-secret';

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test', {
            headers: { 'X-API-Key': 'test-secret' },
        });
        expect(res.status).toBe(200);

        delete process.env.API_KEY;
    });

    test('rejects request without api key', async () => {
        process.env.API_KEY = 'test-secret';

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test');
        expect(res.status).toBe(401);

        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Unauthorized');

        delete process.env.API_KEY;
    });

    test('rejects request with wrong api key', async () => {
        process.env.API_KEY = 'test-secret';

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test', {
            headers: { 'X-API-Key': 'wrong-key' },
        });
        expect(res.status).toBe(401);

        delete process.env.API_KEY;
    });
});
