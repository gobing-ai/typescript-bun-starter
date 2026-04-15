import type { Database, DbAdapter } from './adapter';

let _adapter: DbAdapter | undefined;

/**
 * Lazily initialise the default Bun SQLite adapter.
 *
 * This is a Bun-only convenience for CLI and local development.
 * Production server entry points should call `createDbAdapter()` with
 * an explicit config instead of relying on this singleton.
 *
 * @internal — prefer explicit adapter construction via `createDbAdapter()`.
 */
export function getDefaultAdapter(): DbAdapter {
    if (!_adapter) {
        // Synchronous require() keeps getDefaultAdapter() non-async, avoiding
        // an async cascade through all callers (CLI commands, test setup, etc).
        // This code path is Bun-only — the require() will never run in D1/Workers.
        const { BunSqliteAdapter } = require('./adapters/bun-sqlite') as typeof import('./adapters/bun-sqlite');
        _adapter = new BunSqliteAdapter();
    }
    return _adapter;
}

/**
 * Get the default Database instance (Bun SQLite).
 *
 * Convenience for tests and CLI commands.  Server entry points should
 * construct their own adapter via `createDbAdapter()` and inject it
 * into `SkillService` explicitly.
 */
export function getDb(): Database {
    return getDefaultAdapter().getDb();
}

/**
 * Reset the singleton adapter. Used by tests to force re-initialisation.
 * @internal
 */
export function _resetAdapter(): void {
    _adapter = undefined;
}
