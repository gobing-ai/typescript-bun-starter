import { describe, expect, it } from 'bun:test';
import {
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
} from '../src/api-response';

describe('successResponse', () => {
    it('wraps data with success envelope', () => {
        const res = successResponse({ name: 'test' });
        expect(res.code).toBe(0);
        expect(res.result).toBe('success');
        expect(res.data).toEqual({ name: 'test' });
        expect(res.message).toBe('Success');
    });

    it('accepts a custom message', () => {
        const res = successResponse({ id: 1 }, 'Created');
        expect(res.message).toBe('Created');
    });
});

describe('infoResponse', () => {
    it('wraps data with info envelope', () => {
        const res = infoResponse([{ id: 1 }]);
        expect(res.code).toBe(0);
        expect(res.result).toBe('info');
        expect(res.data).toEqual([{ id: 1 }]);
    });
});

describe('paginatedResponse', () => {
    it('includes pagination metadata', () => {
        const res = paginatedResponse([{ id: 1 }], { total: 100, limit: 10, offset: 0 });
        expect(res.code).toBe(0);
        expect(res.result).toBe('info');
        expect(res.data).toEqual([{ id: 1 }]);
        expect(res.meta).toEqual({ total: 100, limit: 10, offset: 0 });
    });
});

describe('errorResponse', () => {
    it('produces warn result for 4xx codes', () => {
        const res = errorResponse(404, 'Not found');
        expect(res.result).toBe('warn');
        expect(res.code).toBe(404);
        expect(res.data).toBeNull();
    });

    it('produces error result for 5xx codes', () => {
        const res = errorResponse(500, 'Boom');
        expect(res.result).toBe('error');
        expect(res.code).toBe(500);
    });

    it('attaches optional details', () => {
        const res = errorResponse(400, 'Bad', { fields: ['name'] });
        expect(res.details).toEqual({ fields: ['name'] });
    });

    it('omits details when not provided', () => {
        const res = errorResponse(400, 'Bad');
        expect(res.details).toBeUndefined();
    });
});

describe('convenience error helpers', () => {
    it('notFoundResponse uses 404', () => {
        const res = notFoundResponse();
        expect(res.code).toBe(404);
        expect(res.result).toBe('warn');
    });

    it('notFoundResponse accepts custom message and details', () => {
        const res = notFoundResponse('User not found', { userId: 'x' });
        expect(res.message).toBe('User not found');
        expect(res.details).toEqual({ userId: 'x' });
    });

    it('validationErrorResponse uses 422', () => {
        const res = validationErrorResponse({ name: ['Required'] });
        expect(res.code).toBe(422);
        expect(res.details).toEqual({ name: ['Required'] });
    });

    it('badRequestResponse uses 400', () => {
        const res = badRequestResponse('Missing field');
        expect(res.code).toBe(400);
    });

    it('unauthorizedResponse uses 401', () => {
        const res = unauthorizedResponse();
        expect(res.code).toBe(401);
        expect(res.result).toBe('warn');
    });

    it('forbiddenResponse uses 403', () => {
        const res = forbiddenResponse();
        expect(res.code).toBe(403);
    });

    it('conflictResponse uses 409', () => {
        const res = conflictResponse();
        expect(res.code).toBe(409);
    });

    it('internalErrorResponse uses 500 with error result', () => {
        const res = internalErrorResponse();
        expect(res.code).toBe(500);
        expect(res.result).toBe('error');
    });

    it('internalErrorResponse accepts details', () => {
        const res = internalErrorResponse('DB down', { err: 'timeout' });
        expect(res.message).toBe('DB down');
        expect(res.details).toEqual({ err: 'timeout' });
    });
});
