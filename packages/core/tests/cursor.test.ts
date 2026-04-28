import { describe, expect, it } from 'bun:test';
import {
    buildCursorMeta,
    createCursor,
    decodeAndParseCursor,
    decodeCursor,
    encodeCursor,
    encodeCursorFromItem,
    parseCursor,
} from '../src/cursor';

describe('createCursor', () => {
    it('creates a cursor with id only', () => {
        const cursor = createCursor('item-1');
        expect(cursor).toEqual({ id: 'item-1', createdAt: undefined, offset: undefined });
    });

    it('accepts a Date for createdAt', () => {
        const date = new Date('2024-06-15T12:00:00Z');
        const cursor = createCursor('item-1', date);
        expect(cursor.createdAt).toBe(date.getTime());
    });

    it('accepts a number for createdAt', () => {
        const cursor = createCursor('item-1', 1718452800000);
        expect(cursor.createdAt).toBe(1718452800000);
    });

    it('accepts an offset', () => {
        const cursor = createCursor('item-1', undefined, 50);
        expect(cursor.offset).toBe(50);
    });
});

describe('parseCursor', () => {
    it('parses a valid cursor object', () => {
        const result = parseCursor({ id: 'abc', createdAt: 1000, offset: 10 });
        expect(result).toEqual({ id: 'abc', createdAt: 1000, offset: 10 });
    });

    it('parses a valid JSON string', () => {
        const result = parseCursor(JSON.stringify({ id: 'abc', createdAt: 1000 }));
        expect(result).toEqual({ id: 'abc', createdAt: 1000, offset: undefined });
    });

    it('throws on null input', () => {
        expect(() => parseCursor(null as unknown as string)).toThrow('Invalid cursor');
    });

    it('throws on non-object parsed value', () => {
        expect(() => parseCursor('42')).toThrow('Invalid cursor: must be an object');
    });

    it('throws when id is missing', () => {
        expect(() => parseCursor({ createdAt: 1000 })).toThrow('Invalid cursor: missing or invalid id');
    });

    it('throws when id is not a string', () => {
        expect(() => parseCursor({ id: 123 })).toThrow('Invalid cursor: missing or invalid id');
    });

    it('ignores non-numeric createdAt', () => {
        const result = parseCursor({ id: 'abc', createdAt: 'bad' });
        expect(result.createdAt).toBeUndefined();
    });

    it('ignores non-numeric offset', () => {
        const result = parseCursor({ id: 'abc', offset: 'bad' });
        expect(result.offset).toBeUndefined();
    });
});

describe('encodeCursor / decodeCursor', () => {
    it('round-trips a cursor', () => {
        const cursor = { id: 'user-42', createdAt: 1718452800000, offset: 100 };
        const encoded = encodeCursor(cursor);
        const decoded = decodeCursor(encoded);
        expect(JSON.parse(decoded)).toEqual(cursor);
    });

    it('produces URL-safe output', () => {
        const encoded = encodeCursor({ id: 'x', createdAt: 1 });
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
    });

    it('produces consistent output for the same input', () => {
        const a = encodeCursor({ id: 'a', createdAt: 1000 });
        const b = encodeCursor({ id: 'a', createdAt: 1000 });
        expect(a).toBe(b);
    });
});

describe('encodeCursorFromItem', () => {
    it('encodes from item fields', () => {
        const date = new Date('2024-01-01T00:00:00Z');
        const encoded = encodeCursorFromItem('item-x', date, 5);
        const decoded = decodeAndParseCursor(encoded);
        expect(decoded).toEqual({ id: 'item-x', createdAt: date.getTime(), offset: 5 });
    });
});

describe('decodeAndParseCursor', () => {
    it('decodes and parses in one step', () => {
        const encoded = encodeCursor({ id: 'z', createdAt: 500 });
        const result = decodeAndParseCursor(encoded);
        expect(result).toEqual({ id: 'z', createdAt: 500, offset: undefined });
    });

    it('throws on garbled input', () => {
        expect(() => decodeAndParseCursor('garbage')).toThrow();
    });
});

describe('buildCursorMeta', () => {
    it('builds meta with nextCursor when hasMore is true', () => {
        const items = [
            { id: 'a', createdAt: 1000 },
            { id: 'b', createdAt: 2000 },
        ];
        const meta = buildCursorMeta(items, 2, true);
        expect(meta.hasMore).toBe(true);
        expect(meta.limit).toBe(2);
        if (!meta.nextCursor) throw new Error('expected nextCursor');
        const parsed = decodeAndParseCursor(meta.nextCursor);
        expect(parsed.id).toBe('b');
        expect(parsed.createdAt).toBe(2000);
    });

    it('omits nextCursor when hasMore is false', () => {
        const items = [{ id: 'a', createdAt: 1000 }];
        const meta = buildCursorMeta(items, 10, false);
        expect(meta.hasMore).toBe(false);
        expect(meta.nextCursor).toBeUndefined();
    });

    it('handles empty items', () => {
        const meta = buildCursorMeta([], 10, false);
        expect(meta.nextCursor).toBeUndefined();
    });

    it('handles Date createdAt', () => {
        const date = new Date('2024-06-15T12:00:00Z');
        const items = [{ id: 'a', createdAt: date }];
        const meta = buildCursorMeta(items, 1, true);
        if (!meta.nextCursor) throw new Error('expected nextCursor');
        const parsed = decodeAndParseCursor(meta.nextCursor);
        expect(parsed.createdAt).toBe(date.getTime());
    });
});
