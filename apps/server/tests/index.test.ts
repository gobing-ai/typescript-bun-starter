import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
    _resetMetrics,
    _resetTelemetry,
    createDbAdapter,
    initTelemetry,
    shutdownMetrics,
    shutdownTelemetry,
} from '@starter/core';
import { createTestMetricsProvider, flushAndCollect } from '@starter/core/tests/telemetry/metrics-test-helpers';
import { createTestDb } from '@starter/core/tests/test-db';
import serverEntry, { createApp, resetIndexHtmlCache, WEB_DIST_PATH } from '../src/index';

beforeAll(() => {
    // Auth middleware now requires API_KEY or explicit AUTH_DISABLED in non-prod.
    // Tests that exercise auth set/unset API_KEY locally; everything else opts out.
    process.env.AUTH_DISABLED = '1';
});

const cleanupFns: Array<() => void> = [];

afterEach(() => {
    while (cleanupFns.length > 0) {
        cleanupFns.pop()?.();
    }
});

async function makeApp() {
    const { adapter, db } = await createTestDb();
    cleanupFns.push(() => adapter.close());
    return createApp(db);
}

function ensureSpaIndexFixture() {
    const indexPath = resolve(WEB_DIST_PATH, 'index.html');
    if (!existsSync(indexPath)) {
        mkdirSync(dirname(indexPath), { recursive: true });
        writeFileSync(indexPath, '<!doctype html><html><body>spa fixture</body></html>');
        cleanupFns.push(() => unlinkSync(indexPath));
    }
    // The cache is module-scoped; reset so tests that mutate the file see fresh state.
    resetIndexHtmlCache();
    cleanupFns.push(() => resetIndexHtmlCache());
    return indexPath;
}

describe('server entry', () => {
    test('GET / returns health status', async () => {
        const app = await makeApp();
        const res = await app.request('/');

        expect(res.status).toBe(200);

        const body = (await res.json()) as { status: string; timestamp: string };
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeString();
    });

    test('GET /api/health returns an envelope without requiring auth', async () => {
        const originalKey = process.env.API_KEY;
        process.env.API_KEY = 'test-secret';

        const app = await makeApp();
        const res = await app.request('/api/health');

        expect(res.status).toBe(200);

        const body = (await res.json()) as {
            data: { status: string; timestamp: string; version?: string };
        };
        expect(body.data.status).toBe('ok');
        expect(body.data.timestamp).toBeString();

        process.env.API_KEY = originalKey;
    });

    test('GET /doc returns OpenAPI JSON', async () => {
        const app = await makeApp();
        const res = await app.request('/doc');

        expect(res.status).toBe(200);

        const body = (await res.json()) as {
            openapi: string;
            info: { title: string };
            paths: Record<string, unknown>;
        };
        expect(body.openapi).toBe('3.0.0');
        expect(body.info.title).toBe('TypeScript Bun Starter API');
        expect(body.paths['/api/health']).toBeDefined();
        expect(body.paths['/api/skills']).toBeDefined();
    });

    test('GET /swagger returns Swagger UI HTML', async () => {
        const app = await makeApp();
        const res = await app.request('/swagger');

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');

        const html = await res.text();
        expect(html).toContain('swagger');
    });

    test('serves skill routes using the app-scoped database resolver', async () => {
        const app = await makeApp();

        const res = await app.request('/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'entrypoint-skill' }),
        });

        expect(res.status).toBe(201);

        const body = (await res.json()) as { data: { name: string } };
        expect(body.data.name).toBe('entrypoint-skill');
    });

    test('reuses the local Bun SQLite adapter across requests', async () => {
        const originalDbUrl = process.env.DATABASE_URL;
        const dbPath = resolve(process.cwd(), `.tmp/test-${crypto.randomUUID()}.sqlite`);
        const bootstrapAdapter = await createDbAdapter({ driver: 'bun-sqlite', url: dbPath });
        await bootstrapAdapter.exec(`
            CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                config TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        bootstrapAdapter.close();

        process.env.DATABASE_URL = dbPath;
        cleanupFns.push(() => {
            if (originalDbUrl === undefined) {
                delete process.env.DATABASE_URL;
            } else {
                process.env.DATABASE_URL = originalDbUrl;
            }
            rmSync(dbPath, { force: true });
        });

        const app = createApp();

        const createRes = await app.request('/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'reused-adapter-skill' }),
        });
        expect(createRes.status).toBe(201);

        const listRes = await app.request('/api/skills');
        expect(listRes.status).toBe(200);

        const body = (await listRes.json()) as { data: Array<{ name: string }> };
        expect(body.data).toContainEqual(expect.objectContaining({ name: 'reused-adapter-skill' }));
    });

    test('uses request D1 binding when available', async () => {
        const app = await makeApp();
        const binding = {} as D1Database;

        const res = await app.request('/', undefined, { DB: binding });

        expect(res.status).toBe(200);

        const body = (await res.json()) as { status: string };
        expect(body.status).toBe('ok');
    });

    test('resolves static assets from dist/web', () => {
        expect(WEB_DIST_PATH).toBe(resolve(process.cwd(), 'dist/web'));
    });

    test('SPA fallback returns index.html for non-API paths', async () => {
        ensureSpaIndexFixture();
        const app = await makeApp();
        const res = await app.request('/some-spa-route');
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('spa fixture');
    });

    test('SPA fallback falls through when index.html is unavailable', async () => {
        const indexPath = resolve(WEB_DIST_PATH, 'index.html');
        const backupPath = resolve(WEB_DIST_PATH, 'index.html.bak');
        if (existsSync(indexPath)) {
            renameSync(indexPath, backupPath);
            cleanupFns.push(() => renameSync(backupPath, indexPath));
        }
        // Drop any cached index.html before this case so the fallthrough is observed.
        resetIndexHtmlCache();
        cleanupFns.push(() => resetIndexHtmlCache());

        const app = await makeApp();
        const res = await app.request('/missing-spa-route');

        expect(res.status).toBe(404);
    });

    test('SPA fallback skips API routes', async () => {
        const app = await makeApp();
        // /api routes should be handled by the skills router, not SPA fallback
        const res = await app.request('/api/skills');
        expect(res.status).toBe(200);
    });

    test('SPA fallback skips asset paths with known static extensions', async () => {
        const app = await makeApp();
        const res = await app.request('/static/js/app.js');
        expect(res.status).toBe(404);
    });

    test('SPA fallback still serves client routes with dots in the last segment', async () => {
        ensureSpaIndexFixture();
        const app = await makeApp();
        const res = await app.request('/users/jane.doe');

        expect(res.status).toBe(200);
        expect(await res.text()).toContain('spa fixture');
    });

    test('SPA fallback caches index.html so repeated misses skip disk reads', async () => {
        const indexPath = ensureSpaIndexFixture();
        const app = await makeApp();

        // First request loads from disk.
        const first = await app.request('/spa-route-a');
        expect(first.status).toBe(200);

        // Mutate the file on disk; cached value should win.
        writeFileSync(indexPath, '<!doctype html><html><body>changed</body></html>');
        // No cleanup push needed — ensureSpaIndexFixture either created it (and
        // pushed cleanup) or it pre-existed (and we should leave it alone).

        const second = await app.request('/spa-route-b');
        expect(second.status).toBe(200);
        const body = await second.text();
        expect(body).toContain('spa fixture');
        expect(body).not.toContain('changed');
    });

    test('GET /api/skills accepts limit/offset query params', async () => {
        const app = await makeApp();

        for (let i = 0; i < 3; i++) {
            const create = await app.request('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `paged-${i}` }),
            });
            expect(create.status).toBe(201);
        }

        const limited = await app.request('/api/skills?limit=2');
        expect(limited.status).toBe(200);
        const limitedBody = (await limited.json()) as { data: Array<{ name: string }> };
        expect(limitedBody.data).toHaveLength(2);

        const offset = await app.request('/api/skills?limit=2&offset=2');
        expect(offset.status).toBe(200);
        const offsetBody = (await offset.json()) as { data: Array<{ name: string }> };
        expect(offsetBody.data).toHaveLength(1);
    });

    test('GET /api/skills rejects out-of-range limit', async () => {
        const app = await makeApp();
        const res = await app.request('/api/skills?limit=10000');
        expect(res.status).toBe(400);
    });

    test('default export lazily creates and reuses the local app', async () => {
        const originalDbUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = ':memory:';
        cleanupFns.push(() => {
            if (originalDbUrl === undefined) {
                delete process.env.DATABASE_URL;
            } else {
                process.env.DATABASE_URL = originalDbUrl;
            }
        });

        const first = await serverEntry.fetch(new Request('http://localhost/'));
        expect(first.status).toBe(200);

        const firstBody = (await first.json()) as { status: string; timestamp: string };
        expect(firstBody.status).toBe('ok');

        const second = await serverEntry.fetch(new Request('http://localhost/api/health'));
        expect(second.status).toBe(200);

        const secondBody = (await second.json()) as { data: { status: string } };
        expect(secondBody.data.status).toBe('ok');
    });

    test('default export uses request-scoped D1 bindings without local bootstrap', async () => {
        const res = await serverEntry.fetch(new Request('http://localhost/'), {
            DB: {} as D1Database,
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as { status: string };
        expect(body.status).toBe('ok');
    });

    test('emits a server request span when telemetry is initialized', async () => {
        _resetTelemetry();
        const exporter = new InMemorySpanExporter();
        initTelemetry(
            {
                enabled: true,
                serviceName: 'server-test',
            },
            {
                spanProcessors: [new SimpleSpanProcessor(exporter)],
            },
        );

        const app = await makeApp();
        const res = await app.request('/api/health');

        expect(res.status).toBe(200);

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBeGreaterThan(0);
        const serverSpan = spans.find((span) => span.name === 'HTTP GET /api/health');
        expect(serverSpan).toBeDefined();
        expect(serverSpan?.attributes['server.address']).toBe('localhost');
        expect(String(serverSpan?.attributes['server.address'] ?? '')).not.toContain('/');

        await shutdownTelemetry();
    });

    test('still serves requests when telemetry is disabled', async () => {
        _resetTelemetry();
        initTelemetry({ enabled: false });

        const app = await makeApp();
        const res = await app.request('/api/health');

        expect(res.status).toBe(200);

        await shutdownTelemetry();
    });

    test('records request metrics for validation failures', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();

        const app = await makeApp();
        const res = await app.request('/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{',
        });

        expect(res.status).toBe(400);

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.server.request.total')).toBe(1);
        expect(counts.get('http.server.request.duration')).toBe(1);
        expect(counts.get('http.server.request.errors')).toBeUndefined();

        await shutdownMetrics();
    });
});
