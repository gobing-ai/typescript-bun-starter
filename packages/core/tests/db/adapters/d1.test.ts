import { describe, expect, test } from 'bun:test';
import { D1Adapter } from '../../../src/db/adapters/d1';

describe('D1Adapter', () => {
    test('D1Adapter class is exported', () => {
        expect(D1Adapter).toBeDefined();
        expect(typeof D1Adapter).toBe('function');
    });

    test('constructor accepts a D1 binding', () => {
        // Create a minimal mock D1 binding
        const mockBinding = {
            prepare: (_sql: string) => ({
                bind: (..._args: unknown[]) => ({
                    all: async () => ({ results: [], success: true, meta: {} }),
                    run: async () => ({ results: [], success: true, meta: {} }),
                    raw: async () => [],
                    first: async () => null,
                }),
                first: async () => null,
            }),
            dump: async () => new ArrayBuffer(0),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            withSession: () => mockBinding,
        } as unknown as D1Database;

        const adapter = new D1Adapter(mockBinding);
        expect(adapter).toBeDefined();
        expect(adapter.getDb()).toBeDefined();
    });

    test('close is a no-op for D1', () => {
        const mockBinding = {
            prepare: () => ({
                bind: () => ({
                    all: async () => ({ results: [], success: true, meta: {} }),
                    run: async () => ({ results: [], success: true, meta: {} }),
                    raw: async () => [],
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
        } as unknown as D1Database;

        const adapter = new D1Adapter(mockBinding);
        // Should not throw
        expect(() => adapter.close()).not.toThrow();
    });
});
