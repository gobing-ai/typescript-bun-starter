import { getDefaultAdapter } from '@starter/core';

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

// Force in-memory DB before lazy singleton is initialized
process.env.DATABASE_URL = ':memory:';

/**
 * Initialize the default in-memory DB with schema and clean state.
 * Must be called in beforeAll() of each CLI test file.
 */
export async function setupCliTestDb() {
    const adapter = getDefaultAdapter();
    await adapter.exec(CREATE_TABLE_SQL);
    await adapter.exec('DELETE FROM queue_jobs');
}
