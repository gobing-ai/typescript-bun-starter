/**
 * Typed domain errors for the skill service layer.
 *
 * Each error class carries a stable `code` that transport layers (CLI, HTTP)
 * can map to exit codes or HTTP statuses without instanceof gymnastics.
 *
 * Keeping this minimal — only error families the starter actually needs.
 */

export type ErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';

export class AppError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'AppError';
        this.code = code;
    }
}

/** Resource not found. Maps to CLI exit 1 / HTTP 404. */
export class NotFoundError extends AppError {
    constructor(message: string) {
        super('NOT_FOUND', message);
        this.name = 'NotFoundError';
    }
}

/** Input validation failure. Maps to CLI exit 1 / HTTP 400. */
export class ValidationError extends AppError {
    constructor(message: string) {
        super('VALIDATION', message);
        this.name = 'ValidationError';
    }
}

/** Unique-constraint or state conflict. Maps to CLI exit 1 / HTTP 409. */
export class ConflictError extends AppError {
    constructor(message: string) {
        super('CONFLICT', message);
        this.name = 'ConflictError';
    }
}

/** Unexpected infrastructure / runtime failure. Maps to CLI exit 1 / HTTP 500. */
export class InternalError extends AppError {
    constructor(
        message: string,
        readonly cause?: unknown,
    ) {
        super('INTERNAL', message);
        this.name = 'InternalError';
    }
}

/** Type guard — checks if a value is an AppError (including subclasses). */
export function isAppError(e: unknown): e is AppError {
    return e instanceof AppError;
}
