import { describe, expect, test } from "bun:test";
import { BunSqliteAdapter } from "../../../src/db/adapters/bun-sqlite";

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

function extractRawSqlite(adapter: BunSqliteAdapter) {
  const db = adapter.getDb();
  const session = Reflect.get(db, "session");
  return Reflect.get(session, "client");
}

describe("BunSqliteAdapter", () => {
  test("creates in-memory database", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const db = adapter.getDb();
    expect(db).toBeDefined();
    adapter.close();
  });

  test("getDb returns a usable drizzle instance", async () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const db = adapter.getDb();
    const raw = extractRawSqlite(adapter);

    raw.run(CREATE_TABLE_SQL);
    raw.run(
      `INSERT INTO skills (id, name, created_at, updated_at) VALUES ('test-id', 'test-name', 0, 0)`,
    );

    const { skills } = await import("../../../src/db/schema");
    const rows = await db.select().from(skills);
    expect(rows.length).toBe(1);
    expect(rows[0]).toBeDefined();
    const row = rows[0] as (typeof rows)[number];
    expect(row.id).toBe("test-id");
    expect(row.name).toBe("test-name");

    adapter.close();
  });

  test("sets WAL pragma on file-based db", () => {
    const adapter = new BunSqliteAdapter("data/test-wal.db");
    const raw = extractRawSqlite(adapter);
    const result = raw.query("PRAGMA journal_mode").get() as Record<string, string>;
    expect(result.journal_mode).toBe("wal");
    adapter.close();
  });

  test("sets foreign_keys pragma", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const raw = extractRawSqlite(adapter);
    const result = raw.query("PRAGMA foreign_keys").get() as Record<string, number>;
    expect(result.foreign_keys).toBe(1);
    adapter.close();
  });

  test("close does not throw on in-memory db", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    expect(() => adapter.close()).not.toThrow();
  });
});
