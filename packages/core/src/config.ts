/**
 * Core package configuration.
 *
 * Compile-time constants and runtime defaults for @starter/core.
 */
export const CORE_CONFIG = {
    /** Default SQLite database path when DATABASE_URL is not set */
    defaultDbPath: 'data/app.db',

    /** SQLite pragmas applied on connection */
    pragmas: {
        journalMode: 'PRAGMA journal_mode = WAL',
        synchronous: 'PRAGMA synchronous = NORMAL',
        foreignKeys: 'PRAGMA foreign_keys = ON',
    },

    /** Skill validation constraints */
    skill: {
        nameMinLength: 1,
        nameMaxLength: 100,
    },
} as const;
