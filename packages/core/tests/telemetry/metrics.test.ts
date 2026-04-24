import { afterEach, describe, expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
    _resetMetrics,
    getDbOperationDuration,
    getDbOperationErrors,
    getDbOperationTotal,
    getHttpClientRequestDuration,
    getHttpClientRequestErrors,
    getHttpClientRequestTotal,
    getHttpServerRequestDuration,
    getHttpServerRequestErrors,
    getHttpServerRequestTotal,
    initMetrics,
    isMetricsInitialized,
    shutdownMetrics,
} from '../../src/telemetry/metrics';

afterEach(() => {
    _resetMetrics();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Lifecycle
// ---------------------------------------------------------------------------

describe('initMetrics', () => {
    test('initializes when enabled', () => {
        initMetrics({ enabled: true, serviceName: 'test-metrics' });
        expect(isMetricsInitialized()).toBe(true);
    });

    test('no-ops when disabled', () => {
        initMetrics({ enabled: false });
        expect(isMetricsInitialized()).toBe(true);
    });

    test('second call is a no-op', () => {
        initMetrics({ enabled: true, serviceName: 'first' });
        initMetrics({ enabled: true, serviceName: 'second' });
        expect(isMetricsInitialized()).toBe(true);
    });

    test('accepts custom metric readers', () => {
        const exporter = new InMemoryMetricExporter();
        const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 });
        initMetrics({ enabled: true }, { metricReaders: [reader] });
        expect(isMetricsInitialized()).toBe(true);
    });
});

describe('shutdownMetrics', () => {
    test('cleans up after init', async () => {
        initMetrics({ enabled: true });
        expect(isMetricsInitialized()).toBe(true);
        await shutdownMetrics();
        expect(isMetricsInitialized()).toBe(false);
    });

    test('is safe to call without init', async () => {
        await expect(shutdownMetrics()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// HTTP Server instruments
// ---------------------------------------------------------------------------

describe('HTTP server metrics', () => {
    test('request total counter increments', async () => {
        const { reader } = createTestMetricsProvider();

        const counter = getHttpServerRequestTotal();
        counter.add(1, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        counter.add(1, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        counter.add(1, { 'http.request.method': 'POST', 'http.response.status_code': 201 });

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.server.request.total')).toBe(3);
    });

    test('request duration histogram records values', async () => {
        const { reader } = createTestMetricsProvider();

        const histogram = getHttpServerRequestDuration();
        histogram.record(50, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        histogram.record(100, { 'http.request.method': 'GET', 'http.response.status_code': 200 });

        const counts = await flushAndCollect(reader);
        // Histograms report as counts (number of data points)
        expect(counts.get('http.server.request.duration')).toBe(2);
    });

    test('error counter increments for 5xx', async () => {
        const { reader } = createTestMetricsProvider();

        getHttpServerRequestErrors().add(1, { 'http.request.method': 'GET', 'http.response.status_code': 500 });

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.server.request.errors')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// HTTP Client instruments
// ---------------------------------------------------------------------------

describe('HTTP client metrics', () => {
    test('request total counter increments', async () => {
        const { reader } = createTestMetricsProvider();

        getHttpClientRequestTotal().add(1, { 'http.request.method': 'POST', 'http.response.status_code': 201 });

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.total')).toBe(1);
    });

    test('request duration histogram records values', async () => {
        const { reader } = createTestMetricsProvider();

        getHttpClientRequestDuration().record(75, { 'http.request.method': 'GET', 'http.response.status_code': 200 });

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.duration')).toBe(1);
    });

    test('error counter increments', async () => {
        const { reader } = createTestMetricsProvider();

        getHttpClientRequestErrors().add(1, { 'http.request.method': 'GET', 'error.type': 'APIError' });

        const counts = await flushAndCollect(reader);
        expect(counts.get('http.client.request.errors')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// DB instruments
// ---------------------------------------------------------------------------

describe('DB metrics', () => {
    test('operation total counter increments', async () => {
        const { reader } = createTestMetricsProvider();

        getDbOperationTotal().add(1, { 'db.operation': 'insert', 'db.collection': 'skills' });
        getDbOperationTotal().add(1, { 'db.operation': 'select', 'db.collection': 'skills' });

        const counts = await flushAndCollect(reader);
        expect(counts.get('db.client.operation.total')).toBe(2);
    });

    test('operation duration histogram records values', async () => {
        const { reader } = createTestMetricsProvider();

        getDbOperationDuration().record(25, { 'db.operation': 'insert', 'db.collection': 'skills' });

        const counts = await flushAndCollect(reader);
        expect(counts.get('db.client.operation.duration')).toBe(1);
    });

    test('error counter increments', async () => {
        const { reader } = createTestMetricsProvider();

        getDbOperationErrors().add(1, { 'db.operation': 'insert', 'db.collection': 'skills', 'error.type': 'Error' });

        const counts = await flushAndCollect(reader);
        expect(counts.get('db.client.operation.errors')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Noop behavior (no provider)
// ---------------------------------------------------------------------------

describe('noop behavior without provider', () => {
    test('all instrument operations succeed without error', () => {
        // No createTestMetricsProvider() — using global noop
        getHttpServerRequestTotal().add(1, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        getHttpClientRequestTotal().add(1, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        getDbOperationTotal().add(1, { 'db.operation': 'insert', 'db.collection': 'skills' });
        getHttpServerRequestDuration().record(50, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        getHttpClientRequestDuration().record(50, { 'http.request.method': 'GET', 'http.response.status_code': 200 });
        getDbOperationDuration().record(50, { 'db.operation': 'insert', 'db.collection': 'skills' });
        getHttpServerRequestErrors().add(1, { 'http.request.method': 'GET', 'http.response.status_code': 500 });
        getHttpClientRequestErrors().add(1, { 'http.request.method': 'GET', 'error.type': 'APIError' });
        getDbOperationErrors().add(1, { 'db.operation': 'insert', 'db.collection': 'skills', 'error.type': 'Error' });
        // If we get here without throwing, noop behavior works
        expect(true).toBe(true);
    });
});
