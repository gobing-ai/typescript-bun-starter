// @starter/server — entry point

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { configure, getStreamSink } from '@logtape/logtape';
import type { Database, DbAdapterConfig } from '@starter/core';
import { createDbAdapter, getLoggerConfig, skills } from '@starter/core';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';

type D1Binding = Extract<DbAdapterConfig, { driver: 'd1' }>['binding'];

type ServerEnv = {
    Bindings: {
        API_KEY?: string;
        DB?: D1Binding;
    };
    Variables: {
        db: Database;
    };
};

/** Path to the built web assets served by the SPA fallback. */
export const WEB_DIST_PATH = resolve(process.cwd(), 'apps/web/dist');

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
    ...getLoggerConfig(process.env),
    sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
});

/**
 * Create an OpenAPI Hono application.
 *
 * @param localDb - Optional pre-built drizzle Database to inject per-request.
 *                   When omitted, the middleware resolves a D1 binding from the
 *                   request env or falls back to a local bun-sqlite adapter.
 */
export function createApp(localDb?: Database) {
    const app = new OpenAPIHono<ServerEnv>();

    // ── Error & Not-Found ────────────────────────────────────────────────
    app.onError(errorHandler());
    app.notFound(() => new Response(null, { status: 404 }));

    // ── Database middleware ──────────────────────────────────────────────
    app.use('*', async (c, next) => {
        if (localDb) {
            c.set('db', localDb);
            await next();
            return;
        }

        const dbBinding = c.env.DB;
        if (dbBinding) {
            const adapter = await createDbAdapter({ driver: 'd1', binding: dbBinding });
            c.set('db', adapter.getDb());
        } else {
            const adapter = await createDbAdapter({
                driver: 'bun-sqlite',
                url: process.env.DATABASE_URL ?? 'data/app.db',
            });
            c.set('db', adapter.getDb());
        }
        await next();
    });

    // ── Health (root) ────────────────────────────────────────────────────
    app.get('/', (c) => {
        return c.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ── Health (API, no auth required) ───────────────────────────────────
    app.get('/api/health', (c) => {
        return c.json({
            data: {
                status: 'ok',
                timestamp: new Date().toISOString(),
            },
        });
    });

    // ── Auth middleware for protected API routes ─────────────────────────
    app.use('/api/skills/*', authMiddleware());

    // ── Skill CRUD ───────────────────────────────────────────────────────
    app.post('/api/skills', async (c) => {
        const db = c.get('db');
        const body = await c.req.json<{ name: string }>();
        const now = Date.now();
        const id = crypto.randomUUID();

        await db.insert(skills).values({ id, name: body.name, createdAt: now, updatedAt: now });

        return c.json({ data: { name: body.name } }, 201);
    });

    app.get('/api/skills', async (c) => {
        const db = c.get('db');
        const rows = await db.select().from(skills);
        return c.json({ data: rows });
    });

    // ── Swagger UI ───────────────────────────────────────────────────────
    app.get('/swagger', swaggerUI({ url: '/doc' }));

    // ── OpenAPI spec ─────────────────────────────────────────────────────
    app.doc('/doc', (_c) => ({
        openapi: '3.0.0',
        info: {
            title: 'TypeScript Bun Starter API',
            version: '0.1.0',
        },
        paths: {},
    }));

    // ── SPA Fallback ─────────────────────────────────────────────────────
    app.get('*', (c) => {
        const path = c.req.path;

        // Skip API routes and paths with file extensions
        if (path.startsWith('/api/') || path.includes('.')) {
            return c.notFound();
        }

        const indexPath = resolve(WEB_DIST_PATH, 'index.html');
        if (existsSync(indexPath)) {
            const html = readFileSync(indexPath, 'utf-8');
            return c.html(html);
        }

        return c.notFound();
    });

    return app;
}

// ── Default export: lazily-created singleton app ─────────────────────────
function getOrCreateApp() {
    let app: ReturnType<typeof createApp> | undefined = (getOrCreateApp as { _app?: ReturnType<typeof createApp> })
        ._app;
    if (!app) {
        app = createApp();
        (getOrCreateApp as { _app?: ReturnType<typeof createApp> })._app = app;
    }
    return app;
}

export default {
    fetch: (request: Request, env?: Record<string, unknown>) => {
        const app = getOrCreateApp();
        return app.fetch(request, env ?? {});
    },
};
