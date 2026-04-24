import type { MiddlewareHandler } from 'hono';

/**
 * Build the API-key auth middleware.
 *
 * Configuration is resolved from `process.env`:
 * - `API_KEY` (required in production): the expected secret. If set, requests
 *   must present a matching `X-API-Key` header.
 * - `AUTH_DISABLED=1` (non-production only): explicitly skip auth even when
 *   `API_KEY` is unset. Without this, missing `API_KEY` outside production
 *   returns 401 — auth never silently fails open.
 *
 * Throws at construction time when `NODE_ENV=production` and no `API_KEY` is
 * configured, so a misconfigured deploy fails fast instead of running open.
 */
export function authMiddleware(): MiddlewareHandler {
    const isProduction = process.env.NODE_ENV === 'production';
    const envKey = process.env.API_KEY;
    const explicitlyDisabled = process.env.AUTH_DISABLED === '1';

    if (isProduction && !envKey) {
        throw new Error('API_KEY must be set when NODE_ENV=production');
    }

    return async (c, next) => {
        const expectedKey = envKey ?? (c.env as Record<string, string> | undefined)?.API_KEY;

        if (!expectedKey) {
            if (!isProduction && explicitlyDisabled) {
                return next();
            }
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const providedKey = c.req.header('X-API-Key');

        if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        return next();
    };
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
    const lengthMismatch = a.length !== b.length ? 1 : 0;
    // Use the longer string length to avoid short-circuit, pad comparison
    const len = Math.max(a.length, b.length);

    let result = lengthMismatch;
    for (let i = 0; i < len; i++) {
        result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }

    return result === 0;
}
