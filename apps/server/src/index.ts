// @starter/server — entry point

import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { configure, getStreamSink } from '@logtape/logtape';
import { ErrorResponseSchema, PaginationSchema } from '@starter/contracts';
import type { DbAdapter, DbAdapterConfig, DbClient } from '@starter/core';
import {
    createDbAdapter,
    createLoggerSinks,
    getHttpServerRequestDuration,
    getHttpServerRequestErrors,
    getHttpServerRequestTotal,
    getLoggerConfig,
    initMetrics,
    SkillsDao,
    successResponse,
    traceAsync,
} from '@starter/core';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { initServerTelemetry } from './telemetry';

type D1Binding = Extract<DbAdapterConfig, { driver: 'd1' }>['binding'];

type ServerEnv = {
    Bindings: {
        API_KEY?: string;
        DB?: D1Binding;
    };
    Variables: {
        db: DbClient;
    };
};

/** Path to the built web assets served by the SPA fallback. */
export const WEB_DIST_PATH = resolve(process.cwd(), 'dist/web');

const STATIC_ASSET_EXTENSIONS = new Set([
    '.avif',
    '.bmp',
    '.css',
    '.gif',
    '.html',
    '.ico',
    '.jpeg',
    '.jpg',
    '.js',
    '.json',
    '.map',
    '.mjs',
    '.png',
    '.svg',
    '.txt',
    '.webp',
    '.woff',
    '.woff2',
    '.xml',
]);

const errorResponseSchema = z.object(ErrorResponseSchema.shape).openapi('ErrorResponse');

const healthResponseSchema = z
    .object({
        status: z.enum(['ok', 'error']),
        timestamp: z.string(),
        version: z.string().optional(),
    })
    .openapi('HealthResponse');

const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        code: z.literal(0),
        message: z.string(),
        result: z.enum(['success', 'info']),
        data: dataSchema,
    });

const healthEnvelopeSchema = successEnvelopeSchema(healthResponseSchema).openapi('HealthEnvelope');

const skillSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        version: z.number(),
        config: z.string().nullable(),
        createdAt: z.number(),
        updatedAt: z.number(),
    })
    .openapi('Skill');

const skillListEnvelopeSchema = successEnvelopeSchema(z.array(skillSchema)).openapi('SkillListEnvelope');

const createSkillBodySchema = z
    .object({
        name: z.string().min(1),
    })
    .openapi('CreateSkillRequest');

const createSkillEnvelopeSchema = successEnvelopeSchema(z.object({ name: z.string() })).openapi('CreateSkillEnvelope');

const apiHealthRoute = createRoute({
    method: 'get',
    path: '/api/health',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: healthEnvelopeSchema,
                },
            },
            description: 'Returns the API health status.',
        },
    },
});

const listSkillsQuerySchema = z.object(PaginationSchema.shape).openapi('ListSkillsQuery');

const listSkillsRoute = createRoute({
    method: 'get',
    path: '/api/skills',
    request: {
        query: listSkillsQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: skillListEnvelopeSchema,
                },
            },
            description: 'Returns the persisted skills.',
        },
        400: {
            content: {
                'application/json': {
                    schema: errorResponseSchema,
                },
            },
            description: 'Invalid query parameters.',
        },
    },
});

const createSkillRoute = createRoute({
    method: 'post',
    path: '/api/skills',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createSkillBodySchema,
                },
            },
            required: true,
        },
    },
    responses: {
        201: {
            content: {
                'application/json': {
                    schema: createSkillEnvelopeSchema,
                },
            },
            description: 'Creates a skill record.',
        },
        400: {
            content: {
                'application/json': {
                    schema: errorResponseSchema,
                },
            },
            description: 'Invalid request payload.',
        },
        500: {
            content: {
                'application/json': {
                    schema: errorResponseSchema,
                },
            },
            description: 'Unexpected server error.',
        },
    },
});

const loggerConfig = getLoggerConfig(process.env);

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
    ...loggerConfig,
    sinks: createLoggerSinks(loggerConfig, {
        consoleSink: getStreamSink(Writable.toWeb(process.stderr)),
    }),
});

initServerTelemetry();
initMetrics();

/**
 * Create an OpenAPI Hono application.
 *
 * @param localDb - Optional pre-built DB client to inject per-request.
 *                   When omitted, the middleware resolves a D1 binding from the
 *                   request env or falls back to a local bun-sqlite adapter.
 */
export function createApp(localDb?: DbClient) {
    const app = new OpenAPIHono<ServerEnv>();
    let localAdapterPromise: Promise<DbAdapter> | undefined;

    // ── Error & Not-Found ────────────────────────────────────────────────
    app.onError(errorHandler());
    app.notFound(() => new Response(null, { status: 404 }));

    // ── Database middleware ──────────────────────────────────────────────
    app.use('*', async (c, next) => {
        const startTime = performance.now();
        const requestUrl = new URL(c.req.url);
        // Normalized span naming: `HTTP {METHOD} {path}`
        const spanName = `HTTP ${c.req.method} ${c.req.path}`;

        await traceAsync(spanName, async (span) => {
            let responseStatus = 500;
            let errorType: string | undefined;

            span.setAttributes({
                'http.request.method': c.req.method,
                'url.path': c.req.path,
                'server.address': requestUrl.hostname,
            });

            try {
                await next();
                responseStatus = c.res.status;
                span.setAttribute('http.response.status_code', responseStatus);
                if (responseStatus >= 500) {
                    span.setStatus({
                        code: 2,
                        message: `HTTP ${responseStatus}`,
                    });
                }
            } catch (error) {
                responseStatus = c.res.status >= 400 ? c.res.status : 500;
                errorType = error instanceof Error ? error.name : 'Unknown';
                span.setAttribute('http.response.status_code', responseStatus);
                span.recordException(error instanceof Error ? error : new Error(String(error)));
                span.setStatus({
                    code: 2,
                    message: `HTTP ${responseStatus}`,
                });
                throw error;
            } finally {
                const duration = performance.now() - startTime;
                const metricAttrs = {
                    'http.request.method': c.req.method,
                    'http.response.status_code': responseStatus,
                };
                getHttpServerRequestTotal().add(1, metricAttrs);
                getHttpServerRequestDuration().record(duration, metricAttrs);
                if (responseStatus >= 500 || errorType !== undefined) {
                    getHttpServerRequestErrors().add(1, {
                        ...metricAttrs,
                        ...(errorType !== undefined ? { 'error.type': errorType } : {}),
                    });
                }
            }
        });
    });

    app.use('*', async (c, next) => {
        if (localDb) {
            c.set('db', localDb);
            await next();
            return;
        }

        const dbBinding = c.env?.DB;
        if (dbBinding) {
            const adapter = await createDbAdapter({ driver: 'd1', binding: dbBinding });
            c.set('db', adapter.getDb());
        } else {
            localAdapterPromise ??= createDbAdapter({
                driver: 'bun-sqlite',
                url: process.env.DATABASE_URL ?? 'data/app.db',
            }).catch((error) => {
                localAdapterPromise = undefined;
                throw error;
            });
            const adapter = await localAdapterPromise;
            c.set('db', adapter.getDb());
        }
        await next();
    });

    // ── Health (root) ────────────────────────────────────────────────────
    app.get('/', (c) => {
        return c.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ── Health (API, no auth required) ───────────────────────────────────
    app.openapi(apiHealthRoute, (c) => {
        return c.json(
            successResponse({
                status: 'ok' as const,
                timestamp: new Date().toISOString(),
            }),
            200,
        );
    });

    // ── Auth middleware for protected API routes ─────────────────────────
    app.use('/api/skills/*', authMiddleware());

    // ── Skill CRUD ───────────────────────────────────────────────────────
    app.openapi(createSkillRoute, async (c) => {
        const skillsDao = new SkillsDao(c.get('db'));
        const body = c.req.valid('json');
        const created = await skillsDao.createSkill({ name: body.name });

        return c.json(successResponse({ name: created.name }, 'Skill created'), 201);
    });

    app.openapi(listSkillsRoute, async (c) => {
        const skillsDao = new SkillsDao(c.get('db'));
        const { limit, offset } = c.req.valid('query');
        const rows = await skillsDao.listSkills({ limit, offset });
        return c.json(successResponse(rows), 200);
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
    }));

    // ── SPA Fallback ─────────────────────────────────────────────────────
    app.get('*', (c) => {
        const path = c.req.path;

        // Skip API routes and known static asset paths.
        if (path.startsWith('/api/') || isStaticAssetPath(path)) {
            return c.notFound();
        }

        const html = loadCachedIndexHtml();
        if (html === undefined) {
            return c.notFound();
        }
        return c.html(html);
    });

    return app;
}

function isStaticAssetPath(path: string): boolean {
    const extension = extname(path).toLowerCase();
    return STATIC_ASSET_EXTENSIONS.has(extension);
}

let cachedIndexHtml: string | undefined;
let cachedIndexHtmlChecked = false;

/**
 * Load the SPA `index.html` once and cache the result so subsequent
 * fallback misses don't hit the filesystem on every request.
 *
 * Returns `undefined` if the file doesn't exist (server runs without a
 * built web bundle, e.g. API-only deploys).
 */
function loadCachedIndexHtml(): string | undefined {
    if (!cachedIndexHtmlChecked) {
        const indexPath = resolve(WEB_DIST_PATH, 'index.html');
        if (existsSync(indexPath)) {
            cachedIndexHtml = readFileSync(indexPath, 'utf-8');
        }
        cachedIndexHtmlChecked = true;
    }
    return cachedIndexHtml;
}

/** @internal — testing hook to discard the cache between cases. */
export function resetIndexHtmlCache(): void {
    cachedIndexHtml = undefined;
    cachedIndexHtmlChecked = false;
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
