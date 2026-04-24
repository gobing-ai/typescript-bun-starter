// packages/core/src/api-client.ts
// Reusable outbound HTTP client with default OpenTelemetry tracing.

import { type Span, SpanKind } from '@opentelemetry/api';
import {
    ATTR_HTTP_REQUEST_METHOD,
    ATTR_HTTP_RESPONSE_STATUS_CODE,
    ATTR_URL_FULL,
    ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';
import {
    getHttpClientRequestDuration,
    getHttpClientRequestErrors,
    getHttpClientRequestTotal,
} from './telemetry/metrics';
import { traceAsync } from './telemetry/tracing';

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

/** Configuration for creating an {@link APIClient}. */
export interface APIClientConfig {
    /** Base URL for all requests (e.g. `https://api.example.com`). Trailing slashes are stripped. */
    baseUrl: string;
    /** Headers included with every request. */
    defaultHeaders?: Record<string, string>;
    /** Default request timeout in milliseconds. Defaults to `30_000`. Set to `0` to disable. */
    timeout?: number;
    /** Injectable fetch implementation for testing. Defaults to `globalThis.fetch`. */
    fetch?: typeof globalThis.fetch;
}

/** Per-request options passed to convenience methods. */
export interface RequestOptions {
    /** Headers merged on top of the client's default headers. */
    headers?: Record<string, string>;
    /** Per-request timeout override in milliseconds. */
    timeout?: number;
    /**
     * Semantic span name (e.g. `'users.list'`).
     * Defaults to `HTTP {METHOD} {host}` when omitted.
     */
    operationName?: string;
    /** External abort signal combined with the timeout signal. */
    signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Error thrown for non-2xx HTTP responses. */
export class APIError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly url: string;

    constructor(status: number, statusText: string, url: string) {
        super(`HTTP ${status}: ${statusText}`);
        this.name = 'APIError';
        this.status = status;
        this.statusText = statusText;
        this.url = url;
    }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// APIClient
// ---------------------------------------------------------------------------

/**
 * Reusable outbound HTTP client with automatic OpenTelemetry tracing.
 *
 * Every request is wrapped in a `CLIENT` span using HTTP semantic conventions.
 * Callers get distributed-tracing spans by default — no manual instrumentation.
 *
 * @example
 * ```ts
 * const client = new APIClient({
 *   baseUrl: 'https://api.example.com',
 *   defaultHeaders: { Authorization: `Bearer ${token}` },
 * });
 *
 * const users = await client.get<User[]>('/users');
 * const user  = await client.post<User>('/users', { name: 'Ada' });
 * ```
 */
export class APIClient {
    private readonly baseUrl: string;
    private readonly defaultHeaders: Record<string, string>;
    private readonly defaultTimeout: number;
    private readonly fetchImpl: typeof globalThis.fetch;

    constructor(config: APIClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, '');
        this.defaultHeaders = config.defaultHeaders ?? {};
        this.defaultTimeout = config.timeout ?? DEFAULT_TIMEOUT;
        this.fetchImpl = config.fetch ?? globalThis.fetch;
    }

    // -----------------------------------------------------------------------
    // Convenience methods
    // -----------------------------------------------------------------------

    /** Send a GET request. */
    async get<T>(path: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('GET', path, options);
    }

    /** Send a POST request with an optional JSON body. */
    async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('POST', path, { ...options, body });
    }

    /** Send a PUT request with an optional JSON body. */
    async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('PUT', path, { ...options, body });
    }

    /** Send a PATCH request with an optional JSON body. */
    async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('PATCH', path, { ...options, body });
    }

    /** Send a DELETE request. */
    async delete<T>(path: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('DELETE', path, options);
    }

    // -----------------------------------------------------------------------
    // Core request method
    // -----------------------------------------------------------------------

    /**
     * Send an HTTP request.
     *
     * Wraps the fetch in a `CLIENT` span with semantic-convention attributes.
     * Throws {@link APIError} for non-2xx responses. Network and timeout errors
     * propagate as-is (the span status is set to ERROR by `traceAsync`).
     */
    async request<T>(method: string, path: string, options?: RequestOptions & { body?: unknown }): Promise<T> {
        const url = this.buildUrl(path);
        const timeout = options?.timeout ?? this.defaultTimeout;
        // Default span name follows convention: HTTP {METHOD} {host}
        const urlObj = new URL(url);
        const defaultSpanName = `HTTP ${method} ${urlObj.hostname}`;
        const spanName = options?.operationName ?? defaultSpanName;

        const startTime = performance.now();

        return traceAsync(
            spanName,
            async (span: Span) => {
                const headers: Record<string, string> = { ...this.defaultHeaders, ...options?.headers };
                const hasBody = options?.body !== undefined;
                if (hasBody) {
                    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
                }

                const signal = this.buildSignal(timeout, options?.signal);

                const init: RequestInit = { method, headers };
                if (signal) init.signal = signal;
                if (hasBody) {
                    init.body = JSON.stringify(options.body);
                }

                let responseStatus: number | undefined;
                let errorType: string | undefined;

                try {
                    const response = await this.fetchImpl(url, init);
                    responseStatus = response.status;

                    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);

                    if (!response.ok) {
                        const error = new APIError(response.status, response.statusText, url);
                        span.recordException(error);
                        throw error;
                    }

                    if (response.status === 204 || response.status === 205) {
                        return undefined as T;
                    }

                    const text = await response.text();
                    if (text === '') {
                        return undefined as T;
                    }

                    return JSON.parse(text) as T;
                } catch (error) {
                    errorType = error instanceof Error ? error.name : 'Unknown';
                    getHttpClientRequestErrors().add(1, {
                        'http.request.method': method,
                        ...(responseStatus !== undefined ? { 'http.response.status_code': responseStatus } : {}),
                        'error.type': errorType,
                    });
                    throw error;
                } finally {
                    const metricAttrs = {
                        'http.request.method': method,
                        ...(responseStatus !== undefined ? { 'http.response.status_code': responseStatus } : {}),
                    };
                    getHttpClientRequestTotal().add(1, metricAttrs);
                    getHttpClientRequestDuration().record(performance.now() - startTime, {
                        ...metricAttrs,
                        ...(errorType !== undefined ? { 'error.type': errorType } : {}),
                    });
                }
            },
            {
                kind: SpanKind.CLIENT,
                attributes: {
                    [ATTR_HTTP_REQUEST_METHOD]: method,
                    [ATTR_URL_FULL]: url,
                    [ATTR_URL_PATH]: path,
                },
            },
        );
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private buildUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const separator = path.startsWith('/') ? '' : '/';
        return `${this.baseUrl}${separator}${path}`;
    }

    private buildSignal(timeout: number, external?: AbortSignal): AbortSignal | undefined {
        const signals: AbortSignal[] = [];
        if (timeout > 0) {
            signals.push(AbortSignal.timeout(timeout));
        }
        if (external) {
            signals.push(external);
        }
        if (signals.length === 0) return undefined;
        return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
    }
}
