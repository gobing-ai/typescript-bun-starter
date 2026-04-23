import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { _resetAdapter, getDb, getDefaultAdapter } from '../../src/db/client';

const originalDatabaseUrl = process.env.DATABASE_URL;
let adaptersToClose: Array<{ close: () => void }> = [];

beforeEach(() => {
    process.env.DATABASE_URL = ':memory:';
    _resetAdapter();
    adaptersToClose = [];
});

afterEach(() => {
    for (const adapter of adaptersToClose) {
        try {
            adapter.close();
        } catch {
            // Ignore cleanup failures; adapters may already be closed by the test.
        }
    }
    _resetAdapter();

    if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
    }
});

describe('db client singleton', () => {
    test('getDefaultAdapter lazily creates and reuses the singleton adapter', () => {
        const first = getDefaultAdapter();
        adaptersToClose.push(first);
        const second = getDefaultAdapter();

        expect(first).toBe(second);
    });

    test('getDb returns the singleton DB client instance', async () => {
        const adapter = getDefaultAdapter();
        adaptersToClose.push(adapter);
        const db = getDb();

        expect(db).toBe(adapter.getDb());

        const pragma = await adapter.queryFirst<{ foreign_keys: number }>('PRAGMA foreign_keys');
        expect(pragma).toBeDefined();
        expect(pragma.foreign_keys).toBe(1);
    });

    test('resetAdapter forces a fresh adapter instance', () => {
        const first = getDefaultAdapter();
        adaptersToClose.push(first);

        _resetAdapter();

        const second = getDefaultAdapter();
        adaptersToClose.push(second);

        expect(second).not.toBe(first);
    });
});
