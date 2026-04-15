import type { ApiResponse, HealthResponse } from '@starter/contracts';

/**
 * API client for the web application.
 * Uses shared types from @starter/contracts for type-safe API calls.
 *
 * Note: For Zod schema validation helpers, import from './api-validators'
 * instead to avoid pulling zod into the default browser bundle.
 */

function unwrapResponseData<T>(payload: unknown): T | undefined {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as { data?: T }).data;
    }

    return payload as T | undefined;
}

function getErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        // Direct property access for error extraction (no schema dependency)
        const errorProp = (payload as Record<string, unknown>).error;
        if (typeof errorProp === 'string' && errorProp.length > 0) {
            return errorProp;
        }
    }

    return fallback;
}

/**
 * Creates a typed fetch wrapper for API calls.
 *
 * This is the runtime-light default export. It does not import any Zod schemas
 * to keep the browser bundle size minimal for normal API usage.
 */
export function createApiClient(baseUrl: string = '') {
    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
    };

    async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const url = `${baseUrl}${path}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            });

            let payload: unknown;
            const text = await response.text().catch(() => '');
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = text;
                }
            }

            return {
                data: response.ok ? unwrapResponseData<T>(payload) : undefined,
                error: response.ok ? undefined : getErrorMessage(payload, response.statusText),
                status: response.status,
            };
        } catch (err) {
            return {
                error: err instanceof Error ? err.message : 'Network error',
                status: 0,
            };
        }
    }

    return {
        get: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'GET' }),

        post: <T>(path: string, body?: unknown, options?: RequestInit) =>
            request<T>(path, {
                ...options,
                method: 'POST',
                body: body ? JSON.stringify(body) : undefined,
            }),

        put: <T>(path: string, body?: unknown, options?: RequestInit) =>
            request<T>(path, {
                ...options,
                method: 'PUT',
                body: body ? JSON.stringify(body) : undefined,
            }),

        delete: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'DELETE' }),
    };
}

export const api = createApiClient(import.meta.env?.PUBLIC_API_URL ? import.meta.env.PUBLIC_API_URL : '');

export async function fetchHealth(): Promise<ApiResponse<HealthResponse>> {
    return api.get<HealthResponse>('/api/health');
}
