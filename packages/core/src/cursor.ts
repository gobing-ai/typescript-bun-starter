/**
 * Pagination cursor utilities.
 *
 * Cursors are base64-encoded JSON containing the last item's position
 * for stable, opaque, URL-safe pagination tokens.
 */

export interface CursorData {
    id: string;
    createdAt?: number;
    offset?: number;
}

export function createCursor(id: string, createdAt?: Date | number, offset?: number): CursorData {
    const cursor: CursorData = { id };
    if (createdAt !== undefined) {
        cursor.createdAt = typeof createdAt === 'number' ? createdAt : createdAt.getTime();
    }
    if (offset !== undefined) {
        cursor.offset = offset;
    }
    return cursor;
}

export function parseCursor(data: string | Record<string, unknown>): CursorData {
    const parsed = typeof data === 'string' ? (JSON.parse(data) as Record<string, unknown>) : data;

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid cursor: must be an object');
    }

    if (!parsed.id || typeof parsed.id !== 'string') {
        throw new Error('Invalid cursor: missing or invalid id');
    }

    const result: CursorData = { id: parsed.id };
    if (typeof parsed.createdAt === 'number') {
        result.createdAt = parsed.createdAt;
    }
    if (typeof parsed.offset === 'number') {
        result.offset = parsed.offset;
    }
    return result;
}

export function encodeCursor(cursor: CursorData): string {
    const json = JSON.stringify(cursor);
    return Buffer.from(json).toString('base64url');
}

export function decodeCursor(encoded: string): string {
    try {
        return Buffer.from(encoded, 'base64url').toString('utf-8');
    } catch (error) {
        throw new Error(`Invalid cursor encoding: ${error}`);
    }
}

export function encodeCursorFromItem(id: string, createdAt?: Date | number, offset?: number): string {
    const cursor = createCursor(id, createdAt, offset);
    return encodeCursor(cursor);
}

export function decodeAndParseCursor(encoded: string): CursorData {
    const decoded = decodeCursor(encoded);
    return parseCursor(decoded);
}

export function buildCursorMeta<T extends { id: string; createdAt?: number | Date }>(
    items: T[],
    limit: number,
    hasMore: boolean,
): { nextCursor?: string; hasMore: boolean; limit: number } {
    const meta: { nextCursor?: string; hasMore: boolean; limit: number } = {
        hasMore,
        limit,
    };

    if (hasMore) {
        const lastItem = items.at(-1);
        if (lastItem) {
            meta.nextCursor = encodeCursorFromItem(lastItem.id, lastItem.createdAt);
        }
    }

    return meta;
}
