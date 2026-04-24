import { describe, expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { APIClient } from '../src/api-client';
import { _resetMetrics } from '../src/telemetry/metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown): typeof fetch {
    return async () =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
}

function createTestMetricsProvider(): {
    provider: MeterProvider;
    exporter: InMemoryMetricExporter;
    reader: PeriodicExportingMetricReader;
} {
    const exporter = new InMemoryMetricExporter();
    const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 100_000 });
    const provider = new MeterProvider({ readers: [reader] });
    metrics.disable();
    metrics.setGlobalMeterProvider(provider);
    return { provider, exporter, reader };
}

async function flushAndCollect(reader: PeriodicExportingMetricReader): Promise<Map<string, number>> {
    const result = await reader.collect();
    const counts = new Map<string, number>();
    for (const scopeMetrics of result.resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
            const name = metric.descriptor.name;
            let total = 0;
            for (const dp of metric.dataPoints) {
                if (typeof dp.value === 'number' || typeof dp.value === 'object') {
                    total +=
                        typeof dp.value === 'number' ? dp.value : ((dp.value as Record<string, number>).count ?? 0);
                }
            }
            counts.set(name, (counts.get(name) ?? 0) + total);
        }
    }
    return counts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('APIClient metrics integration', () => {
    test('records request total and duration on successful GET', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();
        const client = new APIClient({
            baseUrl: 'https://api.example.com',
            fetch: mockFetch(200, { ok: true }),
        });

        await client.get('/users');

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.total')).toBe(1);
        expect(counts.get('http.client.request.duration')).toBe(1);
        expect(counts.get('http.client.request.errors')).toBeUndefined();
    });

    test('records request total and error on HTTP error', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();
        const client = new APIClient({
            baseUrl: 'https://api.example.com',
            fetch: mockFetch(500, null),
        });

        await expect(client.get('/fail')).rejects.toThrow();

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.total')).toBe(1);
        expect(counts.get('http.client.request.errors')).toBe(1);
    });

    test('records error on network failure', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();
        const failingFetch: typeof fetch = async () => {
            throw new TypeError('fetch failed');
        };
        const client = new APIClient({
            baseUrl: 'https://api.example.com',
            fetch: failingFetch,
        });

        await expect(client.get('/fail')).rejects.toThrow('fetch failed');

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.total')).toBe(1);
        expect(counts.get('http.client.request.duration')).toBe(1);
        expect(counts.get('http.client.request.errors')).toBe(1);
    });

    test('degrades gracefully without a meter provider', async () => {
        _resetMetrics();
        // No createTestMetricsProvider() — noop provider
        const client = new APIClient({
            baseUrl: 'https://api.example.com',
            fetch: mockFetch(200, { ok: true }),
        });

        const result = await client.get<{ ok: boolean }>('/users');
        expect(result.ok).toBe(true);
    });
});
