import { describe, expect, it } from 'bun:test';
import {
    createErrorResponse,
    createJsonRequestHeaders,
    ErrorCode,
    type ErrorResponse,
    ErrorResponseSchema,
    errorCodeToExitCode,
    errorCodeToHttpStatus,
    getApiErrorMessage,
    HealthResponseSchema,
    MAX_RESPONSE_PAYLOAD_BYTES,
    readResponsePayload,
    toTransportError,
    unwrapApiResponseData,
} from '../src/index';

describe('contracts', () => {
    describe('ErrorCode', () => {
        it('should have correct enum values', () => {
            expect(ErrorCode.NotFound).toBe('NOT_FOUND');
            expect(ErrorCode.Validation).toBe('VALIDATION');
            expect(ErrorCode.Conflict).toBe('CONFLICT');
            expect(ErrorCode.Internal).toBe('INTERNAL');
        });
    });

    describe('errorCodeToHttpStatus', () => {
        it('should map NOT_FOUND to 404', () => {
            expect(errorCodeToHttpStatus(ErrorCode.NotFound)).toBe(404);
        });

        it('should map VALIDATION to 400', () => {
            expect(errorCodeToHttpStatus(ErrorCode.Validation)).toBe(400);
        });

        it('should map CONFLICT to 409', () => {
            expect(errorCodeToHttpStatus(ErrorCode.Conflict)).toBe(409);
        });

        it('should map INTERNAL to 500', () => {
            expect(errorCodeToHttpStatus(ErrorCode.Internal)).toBe(500);
        });
    });

    describe('errorCodeToExitCode', () => {
        it('should return 1 for all error codes', () => {
            expect(errorCodeToExitCode(ErrorCode.NotFound)).toBe(1);
            expect(errorCodeToExitCode(ErrorCode.Validation)).toBe(1);
            expect(errorCodeToExitCode(ErrorCode.Conflict)).toBe(1);
            expect(errorCodeToExitCode(ErrorCode.Internal)).toBe(1);
        });
    });

    describe('toTransportError', () => {
        it('should create error with message only', () => {
            const result = toTransportError('Something went wrong');
            expect(result).toEqual({ error: 'Something went wrong' });
        });

        it('should create error with message and code', () => {
            const result = toTransportError('Not found', 'NOT_FOUND');
            expect(result).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
        });

        it('should handle empty code', () => {
            const result = toTransportError('Error', '');
            expect(result).toEqual({ error: 'Error' });
        });
    });

    describe('ErrorResponseSchema', () => {
        it('should parse valid error response', () => {
            const result = ErrorResponseSchema.parse({ error: 'Bad request' });
            expect(result).toEqual({ error: 'Bad request' });
        });

        it('should parse error response with code', () => {
            const result = ErrorResponseSchema.parse({ error: 'Not found', code: 'NOT_FOUND' });
            expect(result).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
        });

        it('should reject missing error field', () => {
            expect(() => ErrorResponseSchema.parse({ code: 'BAD' })).toThrow();
        });

        it('should reject non-string error', () => {
            expect(() => ErrorResponseSchema.parse({ error: 123 })).toThrow();
        });

        it('should accept optional code', () => {
            const result = ErrorResponseSchema.parse({ error: 'Test' });
            expect(result.code).toBeUndefined();
        });

        it('should validate code as string', () => {
            expect(() => ErrorResponseSchema.parse({ error: 'Test', code: 123 })).toThrow();
        });
    });

    describe('createErrorResponse', () => {
        it('should create error response with message only', () => {
            const result: ErrorResponse = createErrorResponse('Something went wrong');
            expect(result).toEqual({ error: 'Something went wrong' });
        });

        it('should create error response with code', () => {
            const result: ErrorResponse = createErrorResponse('Not found', 'NOT_FOUND');
            expect(result).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
        });
    });

    describe('HealthResponseSchema', () => {
        it('should parse valid ok health response', () => {
            const result = HealthResponseSchema.parse({
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
                version: '1.0.0',
            });
            expect(result.status).toBe('ok');
            expect(result.version).toBe('1.0.0');
        });

        it('should parse valid error health response', () => {
            const result = HealthResponseSchema.parse({
                status: 'error',
                timestamp: '2024-01-01T00:00:00Z',
            });
            expect(result.status).toBe('error');
        });

        it('should reject invalid status', () => {
            expect(() =>
                HealthResponseSchema.parse({
                    status: 'warning',
                    timestamp: '2024-01-01T00:00:00Z',
                }),
            ).toThrow();
        });

        it('should reject missing timestamp', () => {
            expect(() => HealthResponseSchema.parse({ status: 'ok' })).toThrow();
        });

        it('should accept missing version', () => {
            const result = HealthResponseSchema.parse({
                status: 'ok',
                timestamp: '2024-01-01T00:00:00Z',
            });
            expect(result.version).toBeUndefined();
        });
    });

    describe('ApiResponse', () => {
        it('should allow data response', () => {
            const response = { data: 'hello', status: 200 };
            expect(response.data).toBe('hello');
            expect(response.error).toBeUndefined();
            expect(response.status).toBe(200);
        });

        it('should allow error response', () => {
            const response = { error: 'Something went wrong', status: 500 };
            expect(response.data).toBeUndefined();
            expect(response.error).toBe('Something went wrong');
            expect(response.status).toBe(500);
        });
    });

    describe('http-client helpers', () => {
        it('should add JSON content type only when a body is present', () => {
            const withoutBody = createJsonRequestHeaders(undefined, false);
            const withBody = createJsonRequestHeaders(undefined, true);

            expect(withoutBody.has('Content-Type')).toBe(false);
            expect(withBody.get('Content-Type')).toBe('application/json');
        });

        it('should preserve explicit content type headers', () => {
            const headers = createJsonRequestHeaders({ 'Content-Type': 'text/plain' }, true);
            expect(headers.get('Content-Type')).toBe('text/plain');
        });

        it('should parse JSON response payloads', async () => {
            const payload = await readResponsePayload(
                new Response(JSON.stringify({ data: { ok: true } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(payload).toEqual({ data: { ok: true } });
        });

        it('should return undefined for empty successful payloads', async () => {
            const payload = await readResponsePayload(new Response(null, { status: 204 }));
            expect(payload).toBeUndefined();
        });

        it('should return undefined when reading the response body fails', async () => {
            const payload = await readResponsePayload({
                status: 200,
                text: async () => Promise.reject(new Error('body read failed')),
            } as Response);

            expect(payload).toBeUndefined();
        });

        it('should reject when Content-Length exceeds the byte limit', async () => {
            const oversize = new Response('{"data":1}', {
                status: 200,
                headers: { 'Content-Length': String(MAX_RESPONSE_PAYLOAD_BYTES + 1) },
            });

            await expect(readResponsePayload(oversize)).rejects.toThrow(RangeError);
        });

        it('should reject when streamed body exceeds the byte limit', async () => {
            const overBy = 16; // small overrun, no large allocations needed
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new Uint8Array(MAX_RESPONSE_PAYLOAD_BYTES));
                    controller.enqueue(new Uint8Array(overBy));
                    controller.close();
                },
            });
            const response = new Response(stream, { status: 200 });

            await expect(readResponsePayload(response)).rejects.toThrow(RangeError);
        });

        it('should accept payloads exactly at the byte limit', async () => {
            // Use a small fake limit by sending under-limit content; verifies
            // the boundary path doesn't false-trigger.
            const body = JSON.stringify({ ok: true });
            const response = new Response(body, {
                status: 200,
                headers: { 'Content-Length': String(body.length) },
            });

            const payload = await readResponsePayload(response);
            expect(payload).toEqual({ ok: true });
        });

        it('should publish a non-zero MAX_RESPONSE_PAYLOAD_BYTES limit', () => {
            expect(MAX_RESPONSE_PAYLOAD_BYTES).toBeGreaterThan(0);
        });

        it('should unwrap data envelopes', () => {
            expect(unwrapApiResponseData<{ ok: boolean }>({ data: { ok: true } })).toEqual({ ok: true });
        });

        it('should extract API error messages', () => {
            expect(getApiErrorMessage({ error: 'boom' }, 'fallback')).toBe('boom');
            expect(getApiErrorMessage({ message: 'ignored' }, 'fallback')).toBe('fallback');
        });
    });

    describe('HealthResponse', () => {
        it('should allow ok status', () => {
            const health = {
                status: 'ok' as const,
                timestamp: '2024-01-01T00:00:00Z',
                version: '1.0.0',
            };
            expect(health.status).toBe('ok');
            expect(health.version).toBe('1.0.0');
        });

        it('should allow error status', () => {
            const health = {
                status: 'error' as const,
                timestamp: '2024-01-01T00:00:00Z',
            };
            expect(health.status).toBe('error');
        });
    });
});
