import {
    type ApiResponse,
    createJsonRequestHeaders,
    getApiErrorMessage,
    type HealthResponse,
    readResponsePayload,
    unwrapApiResponseData,
} from '@starter/contracts';

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

            return {
                data: response.ok ? unwrapApiResponseData<T>(payload) : undefined,
                error: response.ok ? undefined : getApiErrorMessage(payload, response.statusText),
                status: response.status,
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Network error',
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
    };
}

export const browserApi = createBrowserApiClient(import.meta.env?.PUBLIC_API_URL ? import.meta.env.PUBLIC_API_URL : '');

export async function fetchHealth(): Promise<ApiResponse<HealthResponse>> {
    return browserApi.get<HealthResponse>('/api/health');
}
