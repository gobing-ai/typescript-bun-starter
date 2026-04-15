import { describe, expect, it } from 'bun:test';
import { createApiError, validateHealthPayload, validateHealthResponse } from '../src/lib/api-validators';

describe('api-validators', () => {
    describe('validateHealthPayload', () => {
        it('should return null for invalid data', () => {
            expect(validateHealthPayload(null)).toBeNull();
            expect(validateHealthPayload({})).toBeNull();
            expect(validateHealthPayload({ status: 'ok' })).toBeNull();
        });

        it('should return null for invalid status', () => {
            expect(
                validateHealthPayload({
                    status: 'warning',
                    timestamp: '2024-01-01T00:00:00Z',
                }),
            ).toBeNull();
        });

        it('should validate ok health response', () => {
            const result = validateHealthPayload({
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
                version: '1.0.0',
            });
            expect(result).toEqual({
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
                version: '1.0.0',
            });
        });

        it('should validate error health response', () => {
            const result = validateHealthPayload({
                status: 'error',
                timestamp: '2024-01-01T00:00:00Z',
            });
            expect(result).toEqual({
                status: 'error',
                timestamp: '2024-01-01T00:00:00Z',
            });
        });

        it('should validate raw API response payload', () => {
            // This is the shape returned by fetchHealth() data field
            const rawPayload = {
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
            };
            const result = validateHealthPayload(rawPayload);
            expect(result).toEqual(rawPayload);
        });
    });

    describe('validateHealthResponse', () => {
        it('should return null when response has error', async () => {
            const failedResponse = Promise.resolve({ error: 'Network error', status: 0 });
            const result = await validateHealthResponse(failedResponse);
            expect(result).toBeNull();
        });

        it('should return validated health data when response has data', async () => {
            const successResponse = Promise.resolve({
                data: {
                    status: 'ok',
                    timestamp: '2024-01-01T00:00:00Z',
                    version: '1.0.0',
                },
                status: 200,
            });
            const result = await validateHealthResponse(successResponse);
            expect(result).toEqual({
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
                version: '1.0.0',
            });
        });

        it('should return null when data is invalid', async () => {
            const invalidResponse = Promise.resolve({
                data: { status: 'invalid' },
                status: 200,
            });
            const result = await validateHealthResponse(invalidResponse);
            expect(result).toBeNull();
        });
    });

    describe('createApiError', () => {
        it('should create error with message only', () => {
            const result = createApiError('Something went wrong');
            expect(result).toEqual({ error: 'Something went wrong' });
        });

        it('should create error with code', () => {
            const result = createApiError('Not found', 'NOT_FOUND');
            expect(result).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
        });
    });
});
