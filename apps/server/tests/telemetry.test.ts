import { afterEach, describe, expect, test } from 'bun:test';
import { _resetTelemetry, shutdownTelemetry } from '@starter/core';
import { initServerTelemetry } from '../src/telemetry';

const originalServiceName = process.env.OTEL_SERVICE_NAME;

afterEach(async () => {
    if (originalServiceName === undefined) {
        delete process.env.OTEL_SERVICE_NAME;
    } else {
        process.env.OTEL_SERVICE_NAME = originalServiceName;
    }

    _resetTelemetry();
    await shutdownTelemetry();
});

describe('initServerTelemetry', () => {
    test('defaults service name to the server package when env is unset', () => {
        delete process.env.OTEL_SERVICE_NAME;

        const config = initServerTelemetry({ enabled: false });

        expect(config.serviceName).toBe('@starter/server');
    });

    test('prefers OTEL_SERVICE_NAME when it is configured', () => {
        process.env.OTEL_SERVICE_NAME = 'custom-server-service';

        const config = initServerTelemetry({ enabled: false });

        expect(config.serviceName).toBe('custom-server-service');
    });
});
