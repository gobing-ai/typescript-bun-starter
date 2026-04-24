export function createJsonRequestHeaders(headers?: HeadersInit, hasBody = false): Headers {
    const normalizedHeaders = new Headers(headers);

    if (hasBody && !normalizedHeaders.has('Content-Type')) {
        normalizedHeaders.set('Content-Type', 'application/json');
    }

    return normalizedHeaders;
}

export async function readResponsePayload(response: Response): Promise<unknown> {
    if (response.status === 204 || response.status === 205) {
        return undefined;
    }

    const text = await response.text().catch(() => '');
    if (text === '') {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
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
