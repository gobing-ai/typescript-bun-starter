import { initTelemetry, type TelemetryConfig } from '@starter/core';

const DEFAULT_SERVER_SERVICE_NAME = '@starter/server';

export function initServerTelemetry(config?: Partial<TelemetryConfig>): TelemetryConfig {
    const resolvedConfig = {
        ...config,
        serviceName: config?.serviceName ?? process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVER_SERVICE_NAME,
    };

    return initTelemetry(resolvedConfig);
}
