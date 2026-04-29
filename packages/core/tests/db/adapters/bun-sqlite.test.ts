import { describe, expect, test } from 'bun:test';
import { BunSqliteAdapter } from '../../../src/db/adapters/bun-sqlite';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS queue_jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    next_retry_at INTEGER,
    last_error TEXT,
    processing_at INTEGER
  )
`;

describe('BunSqliteAdapter', () => {
    test('creates in-memory database', () => {
        const adapter = new BunSqliteAdapter(':memory:');
        const db = adapter.getDb();
        expect(db).toBeDefined();
        adapter.close();
    });

    test('getDb returns a usable DB client instance', async () => {
        const adapter = new BunSqliteAdapter(':memory:');
        const db = adapter.getDb();
        await adapter.exec(CREATE_TABLE_SQL);
        await adapter.exec(
            `INSERT INTO queue_jobs (id, type, payload, created_at, updated_at) VALUES ('test-id', 'test-job', '{}', 0, 0)`,
        );

        const { queueJobs } = await import('../../../src/db/schema');
        const rows = await db.select().from(queueJobs);
        expect(rows.length).toBe(1);
        expect(rows[0]).toBeDefined();
        const row = rows[0] as (typeof rows)[number];
        expect(row.id).toBe('test-id');
        expect(row.type).toBe('test-job');

        adapter.close();
    });

    test('sets WAL pragma on file-based db', async () => {
        const tmpPath = `${import.meta.dir}/.tmp-wal-test-${Date.now()}.db`;
        const adapter = new BunSqliteAdapter(tmpPath);
        try {
            const result = await adapter.queryFirst<Record<string, string>>('PRAGMA journal_mode');
            expect(result).toBeDefined();
            expect(result.journal_mode).toBe('wal');
        } finally {
            adapter.close();
            // Clean up temp files
            for (const suffix of ['', '-wal', '-shm']) {
                try {
                    require('node:fs').unlinkSync(`${tmpPath}${suffix}`);
                } catch {}
            }
        }
    });

    test('sets foreign_keys pragma', async () => {
        const adapter = new BunSqliteAdapter(':memory:');
        const result = await adapter.queryFirst<Record<string, number>>('PRAGMA foreign_keys');
        expect(result).toBeDefined();
        expect(result.foreign_keys).toBe(1);
        adapter.close();
    });

    test('close does not throw on in-memory db', () => {
        const adapter = new BunSqliteAdapter(':memory:');
        expect(() => adapter.close()).not.toThrow();
    });
});
