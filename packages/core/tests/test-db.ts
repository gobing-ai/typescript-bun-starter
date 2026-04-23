import { createDbAdapter } from '../src/db/adapter';

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

export async function createTestDb() {
    const adapter = await createDbAdapter({ driver: 'bun-sqlite', url: ':memory:' });
    await adapter.exec(CREATE_TABLE_SQL);
    return { adapter, db: adapter.getDb() };
}
