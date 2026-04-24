/**
 * @starter/core telemetry — public API.
 *
 * Downstream apps should import from this barrel:
 *
 * ```ts
 * import { initTelemetry, traceAsync, addSpanAttributes } from '@starter/core';
 * ```
 */

export type { Span, SpanOptions, Tracer } from '@opentelemetry/api';
// Configuration
export { getTelemetryConfig, type TelemetryConfig } from './config';
// Metrics
export {
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
    getMeterProvider,
    initMetrics,
    isMetricsInitialized,
    shutdownMetrics,
} from './metrics';
// SDK lifecycle
// Re-export core OTel API types for convenience
export {
    _resetTelemetry,
    context,
    initTelemetry,
    isTelemetryInitialized,
    propagation,
    shutdownTelemetry,
    trace,
} from './sdk';
// Tracing helpers
export {
    addSpanAttributes,
    addSpanEvent,
    getActiveSpan,
    traceAsync,
    traceSync,
    withSpan,
} from './tracing';
