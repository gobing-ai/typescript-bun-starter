import { context, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { getTelemetryConfig } from '../src/telemetry/config';
import { _resetTelemetry, initTelemetry, isTelemetryInitialized, shutdownTelemetry } from '../src/telemetry/sdk';
import {
    addSpanAttributes,
    addSpanEvent,
    getActiveSpan,
    traceAsync,
    traceSync,
    withSpan,
} from '../src/telemetry/tracing';

afterEach(() => {
    _resetTelemetry();
});

/** Create a test tracer provider backed by an in-memory exporter. */
function createTestProvider(): { provider: BasicTracerProvider; exporter: InMemorySpanExporter } {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
    const ctxManager = new AsyncHooksContextManager();
    ctxManager.enable();
    context.setGlobalContextManager(ctxManager);
    return { provider, exporter };
}

/** Reset the global tracer provider after a test that replaced it. */
async function cleanupTestProvider(provider: BasicTracerProvider) {
    await provider.shutdown();
    // Reset global so other tests get a clean slate
    trace.disable();
}

// ─── Config ────────────────────────────────────────────────────────────────

describe('getTelemetryConfig', () => {
    test('returns defaults when no env vars are set', () => {
        const config = getTelemetryConfig({});
        expect(config.enabled).toBe(true);
        expect(config.serviceName).toBe('typescript-bun-starter');
        expect(config.environment).toBe('development');
        expect(config.exporterEndpoint).toBeUndefined();
        expect(config.exporterProtocol).toBe('http');
    });

    test('respects TELEMETRY_ENABLED=false', () => {
        const config = getTelemetryConfig({ TELEMETRY_ENABLED: 'false' });
        expect(config.enabled).toBe(false);
    });

    test('respects OTEL_SERVICE_NAME', () => {
        const config = getTelemetryConfig({ OTEL_SERVICE_NAME: 'my-service' });
        expect(config.serviceName).toBe('my-service');
    });

    test('respects OTEL_ENVIRONMENT over NODE_ENV', () => {
        const config = getTelemetryConfig({ OTEL_ENVIRONMENT: 'staging', NODE_ENV: 'production' });
        expect(config.environment).toBe('staging');
    });

    test('falls back to NODE_ENV when OTEL_ENVIRONMENT is unset', () => {
        const config = getTelemetryConfig({ NODE_ENV: 'production' });
        expect(config.environment).toBe('production');
    });

    test('respects OTEL_EXPORTER_OTLP_ENDPOINT', () => {
        const config = getTelemetryConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://jaeger:4318/v1/traces' });
        expect(config.exporterEndpoint).toBe('http://jaeger:4318/v1/traces');
    });

    test('prefers OTEL_EXPORTER_OTLP_TRACES_ENDPOINT as fallback', () => {
        const config = getTelemetryConfig({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://traces:4318' });
        expect(config.exporterEndpoint).toBe('http://traces:4318');
    });

    test('extracts service name from OTEL_RESOURCE_ATTRIBUTES', () => {
        const config = getTelemetryConfig({ OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-attr-service,deployment=prod' });
        expect(config.serviceName).toBe('my-attr-service');
    });

    test('OTEL_RESOURCE_ATTRIBUTES without service.name falls back to default', () => {
        const config = getTelemetryConfig({ OTEL_RESOURCE_ATTRIBUTES: 'host.name=myhost' });
        expect(config.serviceName).toBe('typescript-bun-starter');
    });
});

// ─── SDK Lifecycle ─────────────────────────────────────────────────────────

describe('initTelemetry', () => {
    test('initializes when enabled', () => {
        const config = initTelemetry({ enabled: true, serviceName: 'test-service' });
        expect(config.serviceName).toBe('test-service');
        expect(isTelemetryInitialized()).toBe(true);
    });

    test('no-ops when disabled', () => {
        const config = initTelemetry({ enabled: false });
        expect(config.enabled).toBe(false);
        expect(isTelemetryInitialized()).toBe(true);
    });

    test('second call is a no-op', () => {
        initTelemetry({ enabled: true, serviceName: 'first' });
        const config = initTelemetry({ enabled: true, serviceName: 'second' });
        expect(config.serviceName).toBe('first');
    });

    test('uses initTelemetry wiring to export spans through configured span processors', async () => {
        const exporter = new InMemorySpanExporter();

        initTelemetry(
            {
                enabled: true,
                serviceName: 'sdk-export-test',
            },
            {
                spanProcessors: [new SimpleSpanProcessor(exporter)],
            },
        );

        await traceAsync('sdk.export.test', async (span) => {
            expect(span.isRecording()).toBe(true);
        });

        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]?.name).toBe('sdk.export.test');
        expect(spans[0]?.resource.attributes['service.name']).toBe('sdk-export-test');

        await shutdownTelemetry();
    });

    test('does not require an OTLP endpoint to run safely', async () => {
        initTelemetry({
            enabled: true,
            serviceName: 'no-endpoint-test',
            exporterEndpoint: undefined,
        });

        await expect(
            traceAsync('sdk.no-endpoint', async (span) => {
                expect(span.isRecording()).toBe(true);
                return 'ok';
            }),
        ).resolves.toBe('ok');

        await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });
});

describe('shutdownTelemetry', () => {
    test('cleans up after init', async () => {
        initTelemetry({ enabled: true });
        expect(isTelemetryInitialized()).toBe(true);
        await shutdownTelemetry();
        expect(isTelemetryInitialized()).toBe(false);
    });

    test('is safe to call without init', async () => {
        await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });
});

// ─── Tracing Helpers ───────────────────────────────────────────────────────

describe('traceAsync', () => {
    test('executes callback with noop span when no provider is registered', async () => {
        // Without any provider, OTel returns a noop tracer — spans don't record
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
        expect(spans[0]?.status.code).toBe(2); // ERROR

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

        provider.shutdown();
    });
});

describe('addSpanAttributes', () => {
    test('is a no-op when no active span', () => {
        // Should not throw
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
        provider.shutdown();
    });
});
