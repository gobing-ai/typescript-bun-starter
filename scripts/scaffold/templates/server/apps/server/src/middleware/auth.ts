import type { MiddlewareHandler } from 'hono';

export function authMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const expectedKey = process.env.API_KEY ?? (c.env as Record<string, string>)?.API_KEY;

        if (!expectedKey) {
            return next();
        }

        const providedKey = c.req.header('X-API-Key');

        if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        return next();
    };
}

function timingSafeEqual(a: string, b: string): boolean {
    const lengthMismatch = a.length !== b.length ? 1 : 0;
    const len = Math.max(a.length, b.length);

    let result = lengthMismatch;
    for (let i = 0; i < len; i++) {
        result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }

    return result === 0;
}
