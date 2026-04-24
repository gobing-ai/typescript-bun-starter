import { afterEach, describe, expect, test } from 'bun:test';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { _resetTelemetry, initTelemetry, isTelemetryInitialized, shutdownTelemetry } from '../../src/telemetry/sdk';
import { traceAsync } from '../../src/telemetry/tracing';

afterEach(() => {
    _resetTelemetry();
});

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
