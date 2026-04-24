import { describe, expect, test } from 'bun:test';
import * as telemetry from '../../src/telemetry';

describe('telemetry barrel', () => {
    test('re-exports the public telemetry API', () => {
        expect(typeof telemetry.getTelemetryConfig).toBe('function');
        expect(typeof telemetry.initTelemetry).toBe('function');
        expect(typeof telemetry.shutdownTelemetry).toBe('function');
        expect(typeof telemetry.traceAsync).toBe('function');
        expect(typeof telemetry.traceSync).toBe('function');
        expect(typeof telemetry.addSpanAttributes).toBe('function');
        expect(typeof telemetry.addSpanEvent).toBe('function');
        expect(typeof telemetry.getActiveSpan).toBe('function');
        expect(typeof telemetry.withSpan).toBe('function');
    });
});
