import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { errorCodeToHttpStatus } from '@starter/contracts';
import type { Database, Skill } from '@starter/core';
import { isAppError, SkillService, skillInsertSchema, skillSelectSchema, skillUpdateSchema } from '@starter/core';
import type { Context } from 'hono';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ParamsSchema = z.object({
    id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'abc-123' }),
});

// ErrorSchema is Zod-specific (Hono transport layer) so it stays local.
// The shared TransportError interface is in @starter/contracts for type consumers.
const ErrorSchema = z.object({ error: z.string() });

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const listRoute = createRoute({
    method: 'get',
    path: '/skills',
    tags: ['Skills'],
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ data: z.array(skillSelectSchema) }),
                },
            },
            description: 'List all skills',
        },
        500: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Internal server error',
        },
    },
});

const getRoute = createRoute({
    method: 'get',
    path: '/skills/{id}',
    tags: ['Skills'],
    request: {
        params: ParamsSchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ data: skillSelectSchema }),
                },
            },
            description: 'Get a skill by ID',
        },
        400: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Bad request',
        },
        404: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Skill not found',
        },
        500: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Internal server error',
        },
    },
});

const postRoute = createRoute({
    method: 'post',
    path: '/skills',
    tags: ['Skills'],
    request: {
        body: {
            content: { 'application/json': { schema: skillInsertSchema } },
            required: true,
        },
    },
    responses: {
        201: {
            content: {
                'application/json': {
                    schema: z.object({ data: skillSelectSchema }),
                },
            },
            description: 'Skill created',
        },
        400: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Validation error',
        },
        404: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Not found',
        },
        409: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Conflict',
        },
        500: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Internal server error',
        },
    },
});

const patchRoute = createRoute({
    method: 'patch',
    path: '/skills/{id}',
    tags: ['Skills'],
    request: {
        params: ParamsSchema,
        body: {
            content: { 'application/json': { schema: skillUpdateSchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ data: skillSelectSchema }),
                },
            },
            description: 'Skill updated',
        },
        400: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Bad request',
        },
        404: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Skill not found',
        },
        409: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Conflict',
        },
        500: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Internal server error',
        },
    },
});

const deleteRoute = createRoute({
    method: 'delete',
    path: '/skills/{id}',
    tags: ['Skills'],
    request: {
        params: ParamsSchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ data: z.null() }),
                },
            },
            description: 'Skill deleted',
        },
        400: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Bad request',
        },
        404: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Skill not found',
        },
        409: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Conflict',
        },
        500: {
            content: { 'application/json': { schema: ErrorSchema } },
            description: 'Internal server error',
        },
    },
});

// ---------------------------------------------------------------------------
// Error code → HTTP status mapping (delegated to shared contracts)
// ---------------------------------------------------------------------------

/**
 * Maps domain errors to HTTP status using shared contracts.
 * Uses ErrorCode enum for type-safe comparison.
 */
function mapErrorToStatus(err: Error): 400 | 404 | 500 {
    if (isAppError(err)) {
        return errorCodeToHttpStatus(err.code) as 400 | 404 | 500;
    }
    // HTTPError from Hono middleware (e.g. OpenAPI validation)
    if ('status' in err && typeof err.status === 'number') {
        return err.status as 400 | 404 | 500;
    }
    return 500;
}

// ---------------------------------------------------------------------------
// Factory + Handlers
// ---------------------------------------------------------------------------

interface CreateSkillRoutesOptions {
    db?: Database;
    getDb?: (c: Context) => Database | undefined;
}

function resolveService(c: Context, options?: CreateSkillRoutesOptions): SkillService {
    const db = options?.getDb?.(c) ?? options?.db;
    return db ? new SkillService(db) : new SkillService();
}

export function createSkillRoutes(options?: CreateSkillRoutesOptions | Database) {
    const app = new OpenAPIHono();
    const routeOptions = options && 'select' in options ? { db: options } : options;

    app.openapi(listRoute, async (c) => {
        const service = resolveService(c, routeOptions);
        const result = await service.list();
        if (!result.ok) {
            return c.json({ error: result.error.message }, 500);
        }
        return c.json({ data: result.data }, 200);
    });

    app.openapi(getRoute, async (c) => {
        const service = resolveService(c, routeOptions);
        const { id } = c.req.valid('param');
        const result = await service.getById(id);
        if (!result.ok) {
            const status = mapErrorToStatus(result.error);
            return c.json({ error: result.error.message }, status);
        }
        return c.json({ data: result.data }, 200);
    });

    app.openapi(postRoute, async (c) => {
        const service = resolveService(c, routeOptions);
        const input = c.req.valid('json');
        const result = await service.create(input);
        if (!result.ok) {
            const status = mapErrorToStatus(result.error);
            return c.json({ error: result.error.message }, status);
        }
        return c.json({ data: result.data as Skill }, 201);
    });

    app.openapi(patchRoute, async (c) => {
        const service = resolveService(c, routeOptions);
        const { id } = c.req.valid('param');
        const input = c.req.valid('json');
        const result = await service.update(id, input);
        if (!result.ok) {
            const status = mapErrorToStatus(result.error);
            return c.json({ error: result.error.message }, status);
        }
        return c.json({ data: result.data }, 200);
    });

    app.openapi(deleteRoute, async (c) => {
        const service = resolveService(c, routeOptions);
        const { id } = c.req.valid('param');
        const result = await service.delete(id);
        if (!result.ok) {
            const status = mapErrorToStatus(result.error);
            return c.json({ error: result.error.message }, status);
        }
        return c.json({ data: null }, 200);
    });

    return app;
}

export default createSkillRoutes();
