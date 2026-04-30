import { describe, expect, test } from 'bun:test';
import { BunSqliteAdapter } from '../../src/db/adapters/bun-sqlite';
import { applyMigrations } from '../../src/db/migrate';

describe('applyMigrations', () => {
    test('skips non-BunSqliteAdapter with a warning', () => {
        const fakeAdapter = { getDb: () => ({}) } as unknown as Parameters<typeof applyMigrations>[0];

        // Should not throw
        expect(() => applyMigrations(fakeAdapter)).not.toThrow();
    });

    test('runs migrations on BunSqliteAdapter with empty migration folder', () => {
        const adapter = new BunSqliteAdapter(':memory:');

        try {
            // Use a non-existent folder — drizzle-orm treats missing folder as "no migrations"
            // and the __drizzle_migrations table is created but empty.
            expect(() => applyMigrations(adapter, { migrationsFolder: './drizzle' })).not.toThrow();
        } finally {
            adapter.close();
        }
    });
});
