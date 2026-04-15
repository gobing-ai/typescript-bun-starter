// @project/server — entry point

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { configure, getStreamSink } from '@logtape/logtape';
import type { Database, DbAdapterConfig } from '@project/core';
import { createDbAdapter, getLoggerConfig } from '@project/core';
import { serveStatic } from 'hono/bun';
import { SERVER_CONFIG } from './config';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { createSkillRoutes } from './routes/skills';

type D1Binding = Extract<DbAdapterConfig, { driver: 'd1' }>['binding'];

interface ServerEnv {
    API_KEY?: string;
    DB?: D1Binding;
}

interface ServerVariables {
    db?: Database;
}

interface HealthPayload {
    status: 'ok';
    timestamp: string;
    version?: string;
}

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
    ...getLoggerConfig(process.env),
    sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
});

export const WEB_DIST_PATH = resolve(import.meta.dir, '..', '..', 'web', 'dist');

function createHealthPayload(): HealthPayload {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version,
    };
}

export function createApp(localDb?: Database) {
    const app = new OpenAPIHono<{ Bindings: ServerEnv; Variables: ServerVariables }>();

    app.use('*', async (c, next) => {
        const binding = c.env && 'DB' in c.env ? c.env.DB : undefined;

        if (binding) {
            const adapter = await createDbAdapter({ driver: 'd1', binding });
            c.set('db', adapter.getDb());
        } else if (localDb) {
            c.set('db', localDb);
        }
        await next();
    });

    app.get(`${SERVER_CONFIG.apiPrefix}/health`, (c) =>
        c.json({
            data: createHealthPayload(),
        }),
    );

    // Global middleware
    app.onError(errorHandler());
    app.use(`${SERVER_CONFIG.apiPrefix}/*`, authMiddleware());

    // Mount routes — resolve DB per request so Bun local and Workers D1 both work.
    app.route(
        SERVER_CONFIG.apiPrefix,
        createSkillRoutes({
            getDb: (c) => c.var.db,
        }),
    );

    // OpenAPI documentation
    app.doc(SERVER_CONFIG.docPath, {
        openapi: '3.0.0',
        info: { title: 'TypeScript Bun Starter API', version: '0.1.0' },
    });
    app.get(SERVER_CONFIG.swaggerPath, swaggerUI({ url: SERVER_CONFIG.docPath }));

    // Health check
    app.get('/', (c) => c.json(createHealthPayload()));

    // Serve static files from Astro build output (apps/web/dist/)
    app.use('/*', serveStatic({ root: WEB_DIST_PATH, rewriteRequestPath: (p) => p }));

    // SPA fallback — serve index.html for non-API routes
    app.use('/*', async (c, next) => {
        const path = c.req.path;
        // Skip API routes and assets
        if (path.startsWith('/api') || path.includes('.')) {
            return next();
        }
        // Let serveStatic handle existing files, fallback to index.html
        try {
            const indexPath = join(WEB_DIST_PATH, 'index.html');
            const content = readFileSync(indexPath);
            return c.body(new Uint8Array(content), 200, {
                'Content-Type': 'text/html; charset=utf-8',
            });
        } catch {
            return next();
        }
    });

    return app;
}

type ServerApp = ReturnType<typeof createApp>;
type ServerFetchArgs = Parameters<ServerApp['fetch']>;

let localAppPromise: Promise<ServerApp> | undefined;

async function getLocalApp(): Promise<ServerApp> {
    if (!localAppPromise) {
        localAppPromise = (async () => {
            const localAdapter = await createDbAdapter({
                driver: 'bun-sqlite',
                url: process.env.DATABASE_URL,
            });

            return createApp(localAdapter.getDb());
        })();
    }

    return localAppPromise;
}

async function getRequestApp(env: ServerFetchArgs[1]): Promise<ServerApp> {
    if (env && typeof env === 'object' && 'DB' in env && env.DB) {
        return createApp();
    }

    return getLocalApp();
}

// Export AppType for typed RPC client reuse (hono/client)
export type AppType = ServerApp;

export default {
    port: Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : SERVER_CONFIG.defaultPort,
    fetch: async (...args: ServerFetchArgs) => {
        const [request, env, executionCtx] = args;
        const app = await getRequestApp(env);
        return app.fetch(request, env, executionCtx);
    },
};
