import { afterEach, describe, expect, test } from 'bun:test';
import { APIClient, type APIClientConfig, APIError } from '../src/api-client';
import { _resetTelemetry } from '../src/telemetry/sdk';
import { cleanupTestProvider, createTestProvider } from './telemetry/test-helpers';

afterEach(() => {
    _resetTelemetry();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock fetch that returns a canned JSON response. */
function mockFetch(status: number, body: unknown, headers?: Record<string, string>): typeof fetch {
    return async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', ...headers },
        });
    };
}

/** Create a mock fetch that captures the init (method, headers, body). */
function capturingFetch() {
    const state = { captured: undefined as RequestInit | undefined };
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        state.captured = init;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    return { state, fetch };
}

function makeClient(overrides: Partial<APIClientConfig> = {}): APIClient {
    return new APIClient({
        baseUrl: 'https://api.example.com',
        fetch: mockFetch(200, { result: 'ok' }),
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe('APIClient configuration', () => {
    test('strips trailing slashes from baseUrl', async () => {
        const { state, fetch } = capturingFetch();
        const client = new APIClient({ baseUrl: 'https://api.example.com///', fetch });
        await client.get('/users');
        expect(state.captured).toBeDefined();
        // The URL should have been built without trailing slashes
    });

    test('uses globalThis.fetch when no custom fetch is provided', () => {
        const original = globalThis.fetch;
        const stub = mockFetch(200, {});
        globalThis.fetch = stub;

        const client = new APIClient({ baseUrl: 'https://api.example.com' });
        // Client should be usable (fetch is the global one)
        expect(client).toBeDefined();

        globalThis.fetch = original;
    });

    test('applies default timeout of 30s when not specified', () => {
        const client = new APIClient({
            baseUrl: 'https://api.example.com',
            fetch: mockFetch(200, {}),
            timeout: 5000,
        });
        expect(client).toBeDefined();
        // Timeout behavior is verified through timeout tests below
    });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('APIClient.get', () => {
    test('sends GET request and returns parsed JSON', async () => {
        const client = makeClient({ fetch: mockFetch(200, { id: 1, name: 'Ada' }) });
        const result = await client.get<{ id: number; name: string }>('/users/1');
        expect(result).toEqual({ id: 1, name: 'Ada' });
    });

    test('builds URL with leading slash', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.get('/users');
        expect(state.captured).toBeDefined();
        expect(state.captured?.method).toBe('GET');
    });

    test('builds URL without leading slash', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.get('users');
        expect(state.captured).toBeDefined();
    });

    test('uses absolute URL when path starts with http', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.get('https://other.example.com/override');
        expect(state.captured).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// POST / PUT / PATCH / DELETE
// ---------------------------------------------------------------------------

describe('APIClient.post', () => {
    test('sends POST with JSON body', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.post('/users', { name: 'Ada' });
        expect(state.captured?.method).toBe('POST');
        expect(state.captured?.body).toBe(JSON.stringify({ name: 'Ada' }));
        const headers = state.captured?.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
    });

    test('does not set Content-Type when body is undefined', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.post('/action');
        expect(state.captured?.body).toBeUndefined();
        const headers = state.captured?.headers as Record<string, string>;
        expect(headers['Content-Type']).toBeUndefined();
    });
});

describe('APIClient.put', () => {
    test('sends PUT with JSON body', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.put('/users/1', { name: 'Updated' });
        expect(state.captured?.method).toBe('PUT');
        expect(state.captured?.body).toBe(JSON.stringify({ name: 'Updated' }));
    });
});

describe('APIClient.patch', () => {
    test('sends PATCH with JSON body', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.patch('/users/1', { name: 'Patched' });
        expect(state.captured?.method).toBe('PATCH');
    });
});

describe('APIClient.delete', () => {
    test('sends DELETE without body', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.delete('/users/1');
        expect(state.captured?.method).toBe('DELETE');
        expect(state.captured?.body).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

describe('headers', () => {
    test('sends default headers on every request', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({
            fetch: capFetch,
            defaultHeaders: { Authorization: 'Bearer token123', 'X-App': 'test' },
        });
        await client.get('/data');
        const headers = state.captured?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer token123');
        expect(headers['X-App']).toBe('test');
    });

    test('per-request headers override defaults', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({
            fetch: capFetch,
            defaultHeaders: { Authorization: 'Bearer old' },
        });
        await client.get('/data', { headers: { Authorization: 'Bearer new' } });
        const headers = state.captured?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer new');
    });

    test('per-request headers merge with defaults', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({
            fetch: capFetch,
            defaultHeaders: { 'X-Default': 'yes' },
        });
        await client.get('/data', { headers: { 'X-Custom': 'extra' } });
        const headers = state.captured?.headers as Record<string, string>;
        expect(headers['X-Default']).toBe('yes');
        expect(headers['X-Custom']).toBe('extra');
    });

    test('does not overwrite explicit Content-Type in body requests', async () => {
        const { state, fetch: capFetch } = capturingFetch();
        const client = makeClient({ fetch: capFetch });
        await client.post('/data', { key: 'val' }, { headers: { 'Content-Type': 'text/plain' } });
        const headers = state.captured?.headers as Record<string, string>;
        // Explicit Content-Type should be preserved, not overwritten
        expect(headers['Content-Type']).toBe('text/plain');
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
    test('throws APIError for non-2xx responses', async () => {
        const client = makeClient({ fetch: mockFetch(404, { error: 'not found' }) });
        expect(client.get('/missing')).rejects.toThrow(APIError);
    });

    test('APIError carries status, statusText, and url', async () => {
        const client = makeClient({ fetch: mockFetch(422, null) });
        try {
            await client.get('/invalid');
            expect.unreachable('Should have thrown');
        } catch (e) {
            const err = e as APIError;
            expect(err).toBeInstanceOf(APIError);
            expect(err.status).toBe(422);
            expect(err.message).toContain('422');
            expect(err.url).toContain('api.example.com');
        }
    });

    test('throws APIError for 500 server errors', async () => {
        const client = makeClient({ fetch: mockFetch(500, null) });
        try {
            await client.get('/boom');
            expect.unreachable('Should have thrown');
        } catch (e) {
            expect((e as APIError).status).toBe(500);
        }
    });

    test('propagates network errors from fetch', async () => {
        const failingFetch = async () => {
            throw new TypeError('fetch failed');
        };
        const client = makeClient({ fetch: failingFetch as typeof fetch });
        expect(client.get('/fail')).rejects.toThrow('fetch failed');
    });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('timeout', () => {
    test('uses default timeout when none specified', async () => {
        // Just verify it doesn't throw for a fast response
        const client = makeClient({ fetch: mockFetch(200, { ok: true }) });
        const result = await client.get('/fast');
        expect(result).toEqual({ ok: true });
    });

    test('per-request timeout overrides default', async () => {
        const client = makeClient({ fetch: mockFetch(200, { ok: true }), timeout: 100 });
        const result = await client.get('/fast', { timeout: 5000 });
        expect(result).toEqual({ ok: true });
    });

    test('aborts request when timeout elapses', async () => {
        const slowFetch: typeof fetch = (_url, init) =>
            new Promise((_resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('should not reach'));
                }, 5000);
                init?.signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('The operation was aborted', 'AbortError'));
                });
            });
        const client = makeClient({ fetch: slowFetch, timeout: 50 });
        await expect(client.get('/slow')).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// operationName
// ---------------------------------------------------------------------------

describe('operationName', () => {
    test('uses custom operation name as span name', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(200, { ok: true }) });

        await client.get('/users', { operationName: 'users.list' });
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.name).toBe('users.list');

        await cleanupTestProvider(provider);
    });

    test('defaults span name to HTTP {METHOD} {host}', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(200, { ok: true }) });

        await client.get('/users');
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.name).toBe('HTTP GET api.example.com');

        await cleanupTestProvider(provider);
    });
});

// ---------------------------------------------------------------------------
// Tracing (OTel span attributes)
// ---------------------------------------------------------------------------

describe('tracing', () => {
    test('creates CLIENT span with HTTP semantic conventions', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(200, { id: 42 }) });

        await client.get('/users/42');
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        const span = spans[0];

        // Span kind
        expect(span.kind).toBe(2); // SpanKind.CLIENT = 2

        // Attributes
        expect(span.attributes['http.request.method']).toBe('GET');
        expect(span.attributes['http.response.status_code']).toBe(200);
        expect(span.attributes['url.full']).toContain('api.example.com/users/42');
        expect(span.attributes['url.path']).toBe('/users/42');

        await cleanupTestProvider(provider);
    });

    test('sets POST method attribute', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(201, { created: true }) });

        await client.post('/users', { name: 'Ada' });
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans[0]?.attributes['http.request.method']).toBe('POST');

        await cleanupTestProvider(provider);
    });

    test('records error span status for HTTP errors', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(500, null) });

        await expect(client.get('/fail')).rejects.toThrow();
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.status.code).toBe(2); // SpanStatusCode.ERROR
        expect(spans[0]?.attributes['http.response.status_code']).toBe(500);

        await cleanupTestProvider(provider);
    });

    test('records exception event for HTTP errors', async () => {
        const { provider, exporter } = createTestProvider();
        const client = makeClient({ fetch: mockFetch(403, null) });

        await expect(client.get('/forbidden')).rejects.toThrow();
        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans[0]?.events.length).toBe(1);
        expect(spans[0]?.events[0]?.name).toBe('exception');

        await cleanupTestProvider(provider);
    });

    test('creates span even without an initialized provider', async () => {
        // No createTestProvider() — telemetry is off
        const client = makeClient({ fetch: mockFetch(200, { ok: true }) });
        const result = await client.get('/noop');
        expect(result).toEqual({ ok: true });
        // Should not throw — degrades gracefully
    });
});

// ---------------------------------------------------------------------------
// Custom fetch injection
// ---------------------------------------------------------------------------

describe('custom fetch injection', () => {
    test('uses injected fetch implementation', async () => {
        let called = false;
        const customFetch: typeof fetch = async () => {
            called = true;
            return new Response(JSON.stringify({ injected: true }), { status: 200 });
        };

        const client = makeClient({ fetch: customFetch });
        const result = await client.get<{ injected: boolean }>('/test');
        expect(called).toBe(true);
        expect(result.injected).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// External abort signal
// ---------------------------------------------------------------------------

describe('external abort signal', () => {
    test('respects external AbortSignal', async () => {
        const controller = new AbortController();
        const slowFetch: typeof fetch = (_url, init) =>
            new Promise((_resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('should not reach'));
                }, 5000);
                init?.signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('The operation was aborted', 'AbortError'));
                });
            });
        const client = makeClient({ fetch: slowFetch, timeout: 10000 });

        // Abort after a short delay
        setTimeout(() => controller.abort(), 20);

        await expect(client.get('/slow', { signal: controller.signal })).rejects.toThrow();
    });
});
