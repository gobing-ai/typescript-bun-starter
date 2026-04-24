// @starter/contracts — barrel export
//
// Transport-safe types and schemas for cross-tier communication.
// Runtime-light: no DB dependencies, no business logic.

import { z } from 'zod';

// ─── API Envelopes ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    status: number;
}

export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}

export {
    createJsonRequestHeaders,
    getApiErrorMessage,
    readResponsePayload,
    unwrapApiResponseData,
} from './http-client';

// ─── Zod Schemas for Transport Layer ────────────────────────────────────────

/**
 * Zod schema for API error responses.
 * Use this in route definitions and API client validation.
 */
export const ErrorResponseSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Factory to create an error response object.
 * Convenience wrapper around the schema for consistent formatting.
 */
export function createErrorResponse(message: string, code?: string): ErrorResponse {
    return code ? { error: message, code } : { error: message };
}

// ─── Error Mapping ───────────────────────────────────────────────────────────

/**
 * Error code enum for domain errors.
 * Transport layers map these to HTTP statuses or CLI exit codes.
 */
export enum ErrorCode {
    NotFound = 'NOT_FOUND',
    Validation = 'VALIDATION',
    Conflict = 'CONFLICT',
    Internal = 'INTERNAL',
}

/**
 * Maps domain error codes to HTTP status codes.
 */
export function errorCodeToHttpStatus(code: ErrorCode): number {
    switch (code) {
        case ErrorCode.NotFound:
            return 404;
        case ErrorCode.Validation:
            return 400;
        case ErrorCode.Conflict:
            return 409;
        case ErrorCode.Internal:
            return 500;
    }
}

/**
 * Maps domain error codes to CLI exit codes.
 * Convention: 0 = success, 1 = error.
 */
export function errorCodeToExitCode(_code: ErrorCode): number {
    return 1;
}

/**
 * Converts a domain error to a transport-safe API error body.
 */
export interface TransportError {
    error: string;
    code?: string;
}

export function toTransportError(message: string, code?: string): TransportError {
    return {
        error: message,
        ...(code && { code }),
    };
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
    status: 'ok' | 'error';
    timestamp: string;
    version?: string;
}

/**
 * Zod schema for health check responses.
 */
export const HealthResponseSchema = z.object({
    status: z.enum(['ok', 'error']),
    timestamp: z.string(),
    version: z.string().optional(),
});

export type HealthResponseInput = z.infer<typeof HealthResponseSchema>;
