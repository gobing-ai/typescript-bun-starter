import type { Database } from "bun:sqlite";
import { getDb } from "@project/core";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    config TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

// Force in-memory DB before lazy singleton is initialized
process.env.DATABASE_URL = ":memory:";

/**
 * Initialize the default in-memory DB with schema and clean state.
 * Must be called in beforeAll() of each CLI test file.
 */
export function setupCliTestDb() {
  const db = getDb();
  const session = Reflect.get(db, "session");
  const raw = Reflect.get(session, "client") as Database;
  raw.run(CREATE_TABLE_SQL);
  raw.run("DELETE FROM skills");
}
