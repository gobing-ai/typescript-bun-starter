import {
    type ApiResponse,
    createJsonRequestHeaders,
    getApiErrorMessage,
    type HealthResponse,
    readResponsePayload,
    unwrapApiResponseData,
} from '@starter/contracts';

/**
 * API client for the web application.
 * Uses shared types from @starter/contracts for type-safe API calls.
 *
 * Note: For Zod schema validation helpers, import from './api-validators'
 * instead to avoid pulling zod into the default browser bundle.
 */

/**
 * Creates a typed fetch wrapper for API calls.
 *
 * This is the runtime-light default export. It does not import any Zod schemas
 * to keep the browser bundle size minimal for normal API usage.
 */
export function createBrowserApiClient(baseUrl: string = '') {
    async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const url = `${baseUrl}${path}`;
        const hasBody = options.body !== undefined;
        const headers = createJsonRequestHeaders(options.headers, hasBody);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const payload = await readResponsePayload(response);

            const data = response.ok ? unwrapApiResponseData<T>(payload) : undefined;
            const error = response.ok ? undefined : getApiErrorMessage(payload, response.statusText);

            return {
                ...(data !== undefined ? { data } : {}),
                ...(error !== undefined ? { error } : {}),
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
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            }),

        put: <T>(path: string, body?: unknown, options?: RequestInit) =>
            request<T>(path, {
                ...options,
                method: 'PUT',
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            }),

        delete: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'DELETE' }),
    };
}

export const browserApi = createBrowserApiClient(import.meta.env?.PUBLIC_API_URL ? import.meta.env.PUBLIC_API_URL : '');

export async function fetchHealth(): Promise<ApiResponse<HealthResponse>> {
    return browserApi.get<HealthResponse>('/api/health');
}
