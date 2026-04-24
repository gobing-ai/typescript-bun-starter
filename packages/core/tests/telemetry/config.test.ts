import { describe, expect, test } from 'bun:test';
import { getTelemetryConfig } from '../../src/telemetry/config';

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
