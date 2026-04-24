import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../../src/middleware/auth';

describe('authMiddleware', () => {
    const originalKey = process.env.API_KEY;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAuthDisabled = process.env.AUTH_DISABLED;

    beforeEach(() => {
        delete process.env.API_KEY;
        delete process.env.AUTH_DISABLED;
        // Default to a non-production env for most tests; tests that need
        // production semantics override locally.
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        if (originalKey !== undefined) process.env.API_KEY = originalKey;
        else delete process.env.API_KEY;
        if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
        else delete process.env.NODE_ENV;
        if (originalAuthDisabled !== undefined) process.env.AUTH_DISABLED = originalAuthDisabled;
        else delete process.env.AUTH_DISABLED;
    });

    test('rejects with 401 when API_KEY is unset and AUTH_DISABLED is not 1', async () => {
        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test');
        expect(res.status).toBe(401);

        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Unauthorized');
    });

    test('skips auth when API_KEY is unset and AUTH_DISABLED=1 in non-production', async () => {
        process.env.AUTH_DISABLED = '1';

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    test('throws at construction when NODE_ENV=production and no API_KEY', () => {
        process.env.NODE_ENV = 'production';

        expect(() => authMiddleware()).toThrow(/API_KEY must be set/);
    });

    test('does NOT throw in production when API_KEY is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.API_KEY = 'prod-secret';

        expect(() => authMiddleware()).not.toThrow();
    });

    test('AUTH_DISABLED=1 is ignored in production (still requires key)', () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_DISABLED = '1';

        // No API_KEY — production must still throw regardless of AUTH_DISABLED.
        expect(() => authMiddleware()).toThrow(/API_KEY must be set/);
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
    });

    test('rejects request without api key when API_KEY is configured', async () => {
        process.env.API_KEY = 'test-secret';

        const app = new OpenAPIHono();
        app.use('/api/*', authMiddleware());
        app.get('/api/test', (c) => c.json({ ok: true }));

        const res = await app.request('/api/test');
        expect(res.status).toBe(401);

        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Unauthorized');
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
    });
});
