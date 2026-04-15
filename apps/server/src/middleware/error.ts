import { errorCodeToHttpStatus } from '@starter/contracts';
import { isAppError, logger } from '@starter/core';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Global error handler.
 *
 * - AppErrors with known codes get their mapped status + the error message.
 * - Unknown/unexpected errors get 500 with a sanitized message — the real
 *   details are logged internally but never sent to the client.
 */
export function errorHandler() {
    return (err: Error, c: Context) => {
        const status = resolveStatus(err);
        const safeMessage = status >= 500 && !isAppError(err) ? 'Internal Server Error' : err.message;

        logger.error('Unhandled error: {message}', {
            message: err.message,
            stack: err.stack,
        });

        return c.json({ error: safeMessage || 'Internal Server Error' }, status as ContentfulStatusCode);
    };
}

function resolveStatus(err: Error): number {
    // AppErrors carry their own status mapping via shared contracts
    if (isAppError(err)) {
        return errorCodeToHttpStatus(err.code);
    }
    // HTTPError from Hono middleware (e.g. OpenAPI validation)
    if ('status' in err && typeof err.status === 'number') {
        return err.status;
    }
    return 500;
}
