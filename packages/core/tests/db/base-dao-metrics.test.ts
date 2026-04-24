import { describe, expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { DbClient } from '../../src/db/adapter';
import { BaseDao } from '../../src/db/base-dao';
import { _resetMetrics } from '../../src/telemetry/metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal mock DbClient for BaseDao tests. */
function mockDb(): DbClient {
    return {} as DbClient;
}

/** Create a test meter provider with an in-memory exporter. */
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
// Concrete subclass for testing
// ---------------------------------------------------------------------------

class TestDao extends BaseDao {
    constructor(db: DbClient) {
        super(db);
    }

    async doSomething(value: string): Promise<string> {
        return this.withMetrics('select', 'test_table', async () => {
            return `result:${value}`;
        });
    }

    async failSomething(): Promise<void> {
        return this.withMetrics('insert', 'test_table', async () => {
            throw new Error('db connection lost');
        });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseDao.withMetrics', () => {
    test('records operation count and duration on success', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();
        const dao = new TestDao(mockDb());

        const result = await dao.doSomething('hello');
        expect(result).toBe('result:hello');

        const counts = await flushAndCollect(reader);
        expect(counts.get('db.client.operation.total')).toBe(1);
        expect(counts.get('db.client.operation.duration')).toBe(1);
        expect(counts.get('db.client.operation.errors')).toBeUndefined();
    });

    test('records total duration and error count on failure and re-throws', async () => {
        _resetMetrics();
        const { reader } = createTestMetricsProvider();
        const dao = new TestDao(mockDb());

        await expect(dao.failSomething()).rejects.toThrow('db connection lost');

        const counts = await flushAndCollect(reader);
        expect(counts.get('db.client.operation.total')).toBe(1);
        expect(counts.get('db.client.operation.duration')).toBe(1);
        expect(counts.get('db.client.operation.errors')).toBe(1);
    });

    test('degrades gracefully without a meter provider', async () => {
        _resetMetrics();
        // No createTestMetricsProvider() — noop provider
        const dao = new TestDao(mockDb());

        const result = await dao.doSomething('noop');
        expect(result).toBe('result:noop');

        await expect(dao.failSomething()).rejects.toThrow('db connection lost');
    });
});
