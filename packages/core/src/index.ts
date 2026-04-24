// @starter/core — barrel export

export { APIClient, type APIClientConfig, APIError, type RequestOptions } from './api-client';
export { CORE_CONFIG } from './config';
export type { DbAdapter, DbAdapterConfig, DbClient, DbTable } from './db/adapter';
export { createDbAdapter } from './db/adapter';
export { BaseDao } from './db/base-dao';
export { _resetAdapter, getDb, getDefaultAdapter } from './db/client';
export type { CreateSkillInput, SkillRecord } from './db/skills-dao';
export { SkillsDao } from './db/skills-dao';
export type { ErrorCode } from './errors';
export {
    AppError,
    ConflictError,
    InternalError,
    isAppError,
    NotFoundError,
    ValidationError,
} from './errors';
export { logger } from './logger';
export { createLoggerSinks, getLoggerConfig } from './logging';
export type { WriteTarget } from './output';
export { echo, echoError } from './output';
export type { Span, SpanOptions, TelemetryConfig, Tracer } from './telemetry';
export {
    _resetMetrics,
    _resetTelemetry,
    addSpanAttributes,
    addSpanEvent,
    context,
    extractSqlOperation,
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
    getResolvedConfig,
    getTelemetryConfig,
    initMetrics,
    initTelemetry,
    isMetricsInitialized,
    isTelemetryInitialized,
    propagation,
    sanitizeSql,
    shutdownMetrics,
    shutdownTelemetry,
    trace,
    traceAsync,
    traceSync,
    withSpan,
} from './telemetry';
export type { Result } from './types/result';
