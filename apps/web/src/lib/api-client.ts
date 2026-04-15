/**
 * API client for the web application.
 * Uses shared types from @typescript-bun-starter/core for type-safe API calls.
 */

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  version?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Creates a typed fetch wrapper for API calls.
 */
export function createApiClient(baseUrl: string = "") {
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
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

      let data: Record<string, unknown> = {};
      const text = await response.text().catch(() => "");
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Not JSON, ignore
        }
      }

      return {
        data: response.ok ? (data as T) : undefined,
        error: response.ok ? undefined : (data.error as string) || response.statusText,
        status: response.status,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Network error",
        status: 0,
      };
    }
  }

  return {
    get: <T>(path: string, options?: RequestInit) =>
      request<T>(path, { ...options, method: "GET" }),

    post: <T>(path: string, body?: unknown, options?: RequestInit) =>
      request<T>(path, {
        ...options,
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),

    put: <T>(path: string, body?: unknown, options?: RequestInit) =>
      request<T>(path, {
        ...options,
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      }),

    delete: <T>(path: string, options?: RequestInit) =>
      request<T>(path, { ...options, method: "DELETE" }),
  };
}

export const api = createApiClient(
  import.meta.env?.PUBLIC_API_URL ? import.meta.env.PUBLIC_API_URL : "",
);

export async function fetchHealth(): Promise<ApiResponse<HealthResponse>> {
  return api.get<HealthResponse>("/api/health");
}
