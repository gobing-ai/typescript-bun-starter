import { afterEach, describe, expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import { _resetTelemetry } from '../../src/telemetry/sdk';
import {
    addSpanAttributes,
    addSpanEvent,
    getActiveSpan,
    traceAsync,
    traceSync,
    withSpan,
} from '../../src/telemetry/tracing';
import { cleanupTestProvider, createTestProvider } from './test-helpers';

afterEach(() => {
    _resetTelemetry();
});

describe('traceAsync', () => {
    test('executes callback with noop span when no provider is registered', async () => {
        const result = await traceAsync('test.op', async (span) => {
            expect(span.isRecording()).toBe(false);
            return 42;
        });
        expect(result).toBe(42);
    });

    test('creates a recorded span when a provider is registered', async () => {
        const { provider, exporter } = createTestProvider();

        const result = await traceAsync('test.op', async (span) => {
            expect(span.isRecording()).toBe(true);
            return 'hello';
        });

        expect(result).toBe('hello');

        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.name).toBe('test.op');

        await cleanupTestProvider(provider);
    });

    test('records error status on rejection', async () => {
        const { provider, exporter } = createTestProvider();

        await expect(
            traceAsync('test.fail', async () => {
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');

        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.status.code).toBe(2);

        await cleanupTestProvider(provider);
    });
});

describe('traceSync', () => {
    test('executes callback with noop span when no provider is registered', () => {
        const result = traceSync('test.sync', (span) => {
            expect(span.isRecording()).toBe(false);
            return 'sync-result';
        });
        expect(result).toBe('sync-result');
    });

    test('creates a recorded span when a provider is registered', () => {
        const { provider, exporter } = createTestProvider();

        const result = traceSync('test.sync', (span) => {
            expect(span.isRecording()).toBe(true);
            return 99;
        });

        expect(result).toBe(99);

        provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.name).toBe('test.sync');

        void provider.shutdown();
    });
});

describe('addSpanAttributes', () => {
    test('is a no-op when no active span', () => {
        addSpanAttributes({ key: 'value' });
    });

    test('sets attributes on active span', async () => {
        const { provider, exporter } = createTestProvider();

        await traceAsync('attr.test', async () => {
            addSpanAttributes({ 'db.system': 'sqlite', 'db.operation': 'SELECT' });
        });

        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.attributes['db.system']).toBe('sqlite');
        expect(spans[0]?.attributes['db.operation']).toBe('SELECT');

        await cleanupTestProvider(provider);
    });
});

describe('addSpanEvent', () => {
    test('is a no-op when no active span', () => {
        addSpanEvent('custom-event', { detail: 'test' });
    });

    test('adds event to active span', async () => {
        const { provider, exporter } = createTestProvider();

        await traceAsync('event.test', async () => {
            addSpanEvent('cache.miss', { key: 'user:42' });
        });

        await provider.forceFlush();

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.events.length).toBe(1);
        expect(spans[0]?.events[0]?.name).toBe('cache.miss');

        await cleanupTestProvider(provider);
    });
});

describe('getActiveSpan', () => {
    test('returns undefined when no active span', () => {
        expect(getActiveSpan()).toBeUndefined();
    });
});

describe('withSpan', () => {
    test('sets span as active context', () => {
        const { provider } = createTestProvider();
        const tracer = provider.getTracer('test');
        const span = tracer.startSpan('manual');

        let captured: unknown;
        withSpan(span, () => {
            captured = trace.getActiveSpan();
        });

        expect(captured).toBeDefined();

        span.end();
        void provider.shutdown();
    });
});
