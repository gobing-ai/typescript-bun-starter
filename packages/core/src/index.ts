// @starter/core — barrel export

export { getRoles, hasRole } from './access';
export { APIClient, type APIClientConfig, APIError, type RequestOptions } from './api-client';
export {
    API_ERROR_CODES,
    type ApiEnvelope,
    type ApiEnvelopeResult,
    type ApiErrorCode,
    type ApiErrorEnvelope,
    type ApiSuccessEnvelope,
    badRequestResponse,
    conflictResponse,
    errorResponse,
    forbiddenResponse,
    infoResponse,
    internalErrorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse,
    unauthorizedResponse,
    validationErrorResponse,
} from './api-response';
export { CORE_CONFIG } from './config';
export {
    buildCursorMeta,
    type CursorData,
    createCursor,
    decodeAndParseCursor,
    decodeCursor,
    encodeCursor,
    encodeCursorFromItem,
    parseCursor,
} from './cursor';
export { fromMs, nowMs, toMs } from './date';
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
export {
    DBJobQueue,
    DBQueueConsumer,
    type EnqueueOptions,
    type Job,
    type JobHandler,
    type JobQueue,
    type QueueConsumer,
    type QueueConsumerConfig,
    type QueueStats,
} from './job-queue';
export { logger } from './logger';
export { createLoggerSinks, getLoggerConfig } from './logging';
export { getValidatedOrigin, isAllowedOrigin, matchOriginPattern } from './origin';
export type { WriteTarget } from './output';
export { echo, echoError } from './output';
export type { SchedulerOptions } from './scheduler';
export {
    CloudflareSchedulerAdapter,
    initScheduler,
    NodeSchedulerAdapter,
    NoOpSchedulerAdapter,
    type ScheduledJob,
    type ScheduledJobHandler,
    type SchedulerAdapter,
} from './scheduler';
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
