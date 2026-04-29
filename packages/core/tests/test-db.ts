import { createDbAdapter } from '../src/db/adapter';

const CREATE_SKILLS_TABLE = `
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

const CREATE_QUEUE_JOBS_TABLE = `
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

export async function createTestDb() {
    const adapter = await createDbAdapter({ driver: 'bun-sqlite', url: ':memory:' });
    await adapter.exec(CREATE_SKILLS_TABLE);
    await adapter.exec(CREATE_QUEUE_JOBS_TABLE);
    return { adapter, db: adapter.getDb() };
}
