import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { _resetAdapter, getDb, getDefaultAdapter } from '../../src/db/client';

const originalDatabaseUrl = process.env.DATABASE_URL;
let adaptersToClose: Array<{ close: () => void }> = [];

function extractRawSqlite() {
    const db = getDb();
    const session = Reflect.get(db, 'session');
    return Reflect.get(session, 'client') as { query: (sql: string) => { get: () => unknown } };
}

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

    test('getDb returns the singleton drizzle instance', () => {
        const adapter = getDefaultAdapter();
        adaptersToClose.push(adapter);
        const db = getDb();

        expect(db).toBe(adapter.getDb());

        const raw = extractRawSqlite();
        const pragma = raw.query('PRAGMA foreign_keys').get() as { foreign_keys: number };
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
