/**
 * API validation helpers.
 *
 * These are optional utilities for consumers who need Zod schema validation.
 * Import from this module explicitly rather than from api-client.ts to avoid
 * pulling zod into the default browser bundle.
 */

import type { HealthResponse } from '@starter/contracts';
import { createErrorResponse, HealthResponseSchema } from '@starter/contracts';

/**
 * Validate a raw health payload (the inner object from /api/health response).
 * Use this for validating the payload after unwrapping from ApiResponse.
 *
 * @example
 * ```typescript
 * const response = await fetchHealth();
 * if (response.data) {
 *   const health = validateHealthPayload(response.data);
 *   if (health) {
 *     return health.status;
 *   }
 * }
 * ```
 */
export function validateHealthPayload(data: unknown): HealthResponse | null {
    const result = HealthResponseSchema.safeParse(data);
    if (!result.success) {
        return null;
    }

    return {
        status: result.data.status,
        timestamp: result.data.timestamp,
        ...(result.data.version !== undefined ? { version: result.data.version } : {}),
    };
}

/**
 * Validate the full ApiResponse envelope from /api/health.
 * Returns the validated data if successful, null otherwise.
 *
 * @example
 * ```typescript
 * const validated = await validateHealthResponse(api.get('/api/health'));
 * ```
 */
export async function validateHealthResponse(
    response: Promise<{ data?: HealthResponse; error?: string; status: number }>,
): Promise<HealthResponse | null> {
    const result = await response;
    if (result.data) {
        return validateHealthPayload(result.data);
    }
    return null;
}

/**
 * Create a typed error response using the shared factory.
 */
export function createApiError(message: string, code?: string) {
    return createErrorResponse(message, code);
}
