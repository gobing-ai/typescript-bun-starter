import { describe, expect, test } from 'bun:test';
import { AppError, ConflictError, InternalError, isAppError, NotFoundError, ValidationError } from '../src/errors';

describe('AppError', () => {
    test('sets code and message', () => {
        const err = new AppError('VALIDATION', 'bad input');
        expect(err.code).toBe('VALIDATION');
        expect(err.message).toBe('bad input');
        expect(err.name).toBe('AppError');
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
    });
});

describe('NotFoundError', () => {
    test('has NOT_FOUND code', () => {
        const err = new NotFoundError('Skill not found: x');
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Skill not found: x');
        expect(err.name).toBe('NotFoundError');
        expect(err).toBeInstanceOf(AppError);
    });
});

describe('ValidationError', () => {
    test('has VALIDATION code', () => {
        const err = new ValidationError('name must not be blank');
        expect(err.code).toBe('VALIDATION');
        expect(err.message).toBe('name must not be blank');
        expect(err.name).toBe('ValidationError');
        expect(err).toBeInstanceOf(AppError);
    });
});

describe('ConflictError', () => {
    test('has CONFLICT code', () => {
        const err = new ConflictError('duplicate name');
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toBe('duplicate name');
        expect(err.name).toBe('ConflictError');
        expect(err).toBeInstanceOf(AppError);
    });
});

describe('InternalError', () => {
    test('has INTERNAL code', () => {
        const cause = new Error('db down');
        const err = new InternalError('Failed to create skill', cause);
        expect(err.code).toBe('INTERNAL');
        expect(err.message).toBe('Failed to create skill');
        expect(err.name).toBe('InternalError');
        expect(err.cause).toBe(cause);
        expect(err).toBeInstanceOf(AppError);
    });

    test('works without cause', () => {
        const err = new InternalError('unexpected');
        expect(err.code).toBe('INTERNAL');
        expect(err.cause).toBeUndefined();
    });
});

describe('isAppError', () => {
    test('returns true for AppError', () => {
        expect(isAppError(new AppError('INTERNAL', 'x'))).toBe(true);
        expect(isAppError(new NotFoundError('x'))).toBe(true);
        expect(isAppError(new ValidationError('x'))).toBe(true);
        expect(isAppError(new ConflictError('x'))).toBe(true);
        expect(isAppError(new InternalError('x'))).toBe(true);
    });

    test('returns false for plain Error', () => {
        expect(isAppError(new Error('x'))).toBe(false);
    });

    test('returns false for non-Error values', () => {
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
        expect(isAppError('error')).toBe(false);
        expect(isAppError(42)).toBe(false);
    });
});
