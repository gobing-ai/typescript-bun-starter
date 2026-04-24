// @starter/core — barrel export

export type { APIClientConfig, RequestOptions } from './api-client';
// API Client
export { APIClient, APIError } from './api-client';
// Config
export { CORE_CONFIG } from './config';
export type { DbAdapter, DbAdapterConfig, DbClient, DbTable } from './db/adapter';
export { createDbAdapter } from './db/adapter';
// Database
export { BaseDao } from './db/base-dao';
export { _resetAdapter, getDb, getDefaultAdapter } from './db/client';
export type { CreateSkillInput, SkillRecord } from './db/skills-dao';
export { SkillsDao } from './db/skills-dao';
export type { ErrorCode } from './errors';
// Errors
export {
    AppError,
    ConflictError,
    InternalError,
    isAppError,
    NotFoundError,
    ValidationError,
} from './errors';
// Logger
export { logger } from './logger';
export { createLoggerSinks, getLoggerConfig } from './logging';
export type { WriteTarget } from './output';
// Output
export { echo, echoError } from './output';
export type { Span, SpanOptions, TelemetryConfig, Tracer } from './telemetry';
// Telemetry
// Metrics
export {
    _resetMetrics,
    _resetTelemetry,
    addSpanAttributes,
    addSpanEvent,
    context,
    getActiveSpan,
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
    getTelemetryConfig,
    initMetrics,
    initTelemetry,
    isMetricsInitialized,
    isTelemetryInitialized,
    propagation,
    shutdownMetrics,
    shutdownTelemetry,
    trace,
    traceAsync,
    traceSync,
    withSpan,
} from './telemetry';
// Types
export type { Result } from './types/result';
