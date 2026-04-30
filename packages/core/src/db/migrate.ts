import { migrate as drizzleMigrate } from 'drizzle-orm/bun-sqlite/migrator';
import { logger } from '../logger';
import type { DbAdapter } from './adapter';
import { BunSqliteAdapter } from './adapters/bun-sqlite';

export interface MigrationOptions {
    /** Path to migration SQL files. Default: './drizzle' */
    migrationsFolder?: string;
    /** Name of the migrations tracking table. Default: '__drizzle_migrations' */
    migrationsTable?: string;
}

/**
 * Apply pending migrations using drizzle-orm's built-in migrator.
 *
 * Tracks applied migrations in the `__drizzle_migrations` table.
 * Safe to call on every startup — already-applied migrations are skipped.
 *
 * Only works with BunSqliteAdapter. D1 migrations should use
 * `wrangler d1 migrations apply` instead.
 *
 * @param adapter - A DbAdapter instance (must be BunSqliteAdapter).
 * @param options - Optional migration folder and table name overrides.
 */
export function applyMigrations(adapter: DbAdapter, options?: MigrationOptions): void {
    if (!(adapter instanceof BunSqliteAdapter)) {
        logger.warn('Skipping in-app migrations: only supported for bun-sqlite adapter');
        return;
    }

    const folder = options?.migrationsFolder ?? './drizzle';
    const table = options?.migrationsTable;

    logger.info('Applying database migrations from {folder}', { folder });

    drizzleMigrate(adapter.getDrizzleDb(), {
        migrationsFolder: folder,
        ...(table !== undefined ? { migrationsTable: table } : {}),
    });

    logger.info('Database migrations complete');
}
