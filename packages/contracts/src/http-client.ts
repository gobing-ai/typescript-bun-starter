/** Hard cap on the response body `readResponsePayload` will buffer (8 MiB). */
export const MAX_RESPONSE_PAYLOAD_BYTES = 8 * 1024 * 1024;

export function createJsonRequestHeaders(headers?: HeadersInit, hasBody = false): Headers {
    const normalizedHeaders = new Headers(headers);

    if (hasBody && !normalizedHeaders.has('Content-Type')) {
        normalizedHeaders.set('Content-Type', 'application/json');
    }

    return normalizedHeaders;
}

/**
 * Read and parse a `Response` body, with an upper byte budget to defend
 * against unbounded upstream payloads (DoS / memory exhaustion).
 *
 * Returns `undefined` for 204/205 / empty bodies. Returns the parsed JSON
 * value when the body parses, otherwise the raw text. Throws `RangeError`
 * when either the advertised `Content-Length` or the streamed body exceeds
 * {@link MAX_RESPONSE_PAYLOAD_BYTES}.
 */
export async function readResponsePayload(response: Response): Promise<unknown> {
    if (response.status === 204 || response.status === 205) {
        return undefined;
    }

    const contentLength = Number(response.headers?.get?.('Content-Length') ?? Number.NaN);
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_PAYLOAD_BYTES) {
        throw new RangeError(
            `Response payload exceeds ${MAX_RESPONSE_PAYLOAD_BYTES} byte limit (Content-Length=${contentLength})`,
        );
    }

    const text = await readBoundedText(response);
    if (text === undefined) {
        return undefined;
    }
    if (text === '') {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function readBoundedText(response: Response): Promise<string | undefined> {
    const body = response.body;
    if (!body) {
        // No streamable body (e.g. mocked Response with only `text()`).
        // Fall back to text() but still error if the result exceeds the cap.
        try {
            const text = await response.text();
            if (typeof text === 'string' && text.length > MAX_RESPONSE_PAYLOAD_BYTES) {
                throw new RangeError(`Response payload exceeds ${MAX_RESPONSE_PAYLOAD_BYTES} byte limit`);
            }
            return text;
        } catch (err) {
            if (err instanceof RangeError) throw err;
            return undefined;
        }
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            received += value.byteLength;
            if (received > MAX_RESPONSE_PAYLOAD_BYTES) {
                await reader.cancel();
                throw new RangeError(
                    `Response payload exceeds ${MAX_RESPONSE_PAYLOAD_BYTES} byte limit (received=${received})`,
                );
            }
            chunks.push(value);
        }
    } catch (err) {
        if (err instanceof RangeError) throw err;
        return undefined;
    } finally {
        reader.releaseLock?.();
    }

    if (received === 0) {
        return '';
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8').decode(merged);
}

export function unwrapApiResponseData<T>(payload: unknown): T | undefined {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as { data?: T }).data;
    }

    return payload as T | undefined;
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const errorProp = (payload as Record<string, unknown>).error;
        if (typeof errorProp === 'string' && errorProp.length > 0) {
            return errorProp;
        }
    }

    return fallback;
}
