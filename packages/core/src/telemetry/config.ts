/**
 * Telemetry configuration for @starter/core.
 *
 * Reads configuration from environment variables following OpenTelemetry
 * conventions where possible. When telemetry is disabled or partially
 * configured, all operations degrade to no-ops.
 */

export interface TelemetryConfig {
    /** Master switch — when false, all tracing degrades to no-ops. */
    enabled: boolean;
    /** Logical service name emitted on every span. */
    serviceName: string;
    /** Deployment environment (development, staging, production). */
    environment: string;
    /** OTLP exporter endpoint (e.g. `http://localhost:4318/v1/traces`). */
    exporterEndpoint?: string | undefined;
    /** Export protocol — only `http` is supported in v1. */
    exporterProtocol: 'http';
}

type Environment = Record<string, string | undefined>;

const DEFAULTS = {
    enabled: true as const,
    serviceName: 'typescript-bun-starter' as const,
    environment: 'development' as const,
    exporterProtocol: 'http' as const,
};

function parseBooleanEnv(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    return value === '1' || value === 'true';
}

function extractServiceName(attrs?: string): string | undefined {
    if (!attrs) return undefined;
    for (const seg of attrs.split(',')) {
        if (seg.startsWith('service.name=')) {
            return seg.split('=')[1];
        }
    }
    return undefined;
}

export function getTelemetryConfig(env: Environment = process.env): TelemetryConfig {
    const enabled = parseBooleanEnv(env.TELEMETRY_ENABLED) ?? parseBooleanEnv(env.OTEL_SDK_DISABLED) !== true;
    const serviceName =
        env.OTEL_SERVICE_NAME ?? extractServiceName(env.OTEL_RESOURCE_ATTRIBUTES) ?? DEFAULTS.serviceName;

    return {
        enabled,
        serviceName,
        environment: env.OTEL_ENVIRONMENT ?? env.NODE_ENV ?? DEFAULTS.environment,
        exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
        exporterProtocol: (env.OTEL_EXPORTER_OTLP_PROTOCOL as 'http') ?? DEFAULTS.exporterProtocol,
    };
}
