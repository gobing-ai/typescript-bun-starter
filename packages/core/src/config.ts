/**
 * Core package configuration.
 *
 * These are compile-time constants and runtime defaults for @project/core.
 * Environment-dependent values (DATABASE_URL) are resolved at the adapter level.
 */
export const CORE_CONFIG = {
  /** Default SQLite database path when DATABASE_URL is not set */
  defaultDbPath: "data/app.db",

  /** SQLite pragmas applied on connection */
  pragmas: {
    journalMode: "PRAGMA journal_mode = WAL",
    synchronous: "PRAGMA synchronous = NORMAL",
    foreignKeys: "PRAGMA foreign_keys = ON",
  },

  /** Skill field constraints — mirrors the Zod schemas in schemas/skill.ts */
  skill: {
    nameMaxLength: 100,
    nameMinLength: 1,
  },
} as const;
