import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { standardColumns } from './columns';

export const skills = sqliteTable('skills', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    version: integer('version').notNull().default(1),
    config: text('config'),
    ...standardColumns,
});

export const queueJobs = sqliteTable('queue_jobs', {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    ...standardColumns,
    nextRetryAt: integer('next_retry_at'),
    lastError: text('last_error'),
    processingAt: integer('processing_at'),
});
