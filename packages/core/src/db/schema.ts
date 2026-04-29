import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const skills = sqliteTable('skills', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    version: integer('version').notNull().default(1),
    config: text('config'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});

export const queueJobs = sqliteTable('queue_jobs', {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    nextRetryAt: integer('next_retry_at'),
    lastError: text('last_error'),
    processingAt: integer('processing_at'),
});
