import { nowMs } from '../date';
import type { DbClient } from '../db/adapter';
import { sql } from '../db/query-helpers';
import { queueJobs } from '../db/schema';
import type { EnqueueOptions, JobQueue } from './types';

/**
 * DB-backed job queue.
 *
 * Enqueues jobs into the `queue_jobs` table. Works with any DB adapter
 * (bun-sqlite, D1, etc.) through drizzle-orm.
 */
export class DBJobQueue implements JobQueue {
    constructor(private readonly db: DbClient) {}

    async enqueue(type: string, payload: unknown, options?: EnqueueOptions): Promise<string> {
        const maxRetries = options?.maxRetries ?? 3;
        const now = nowMs();
        const id = crypto.randomUUID();

        await this.db.insert(queueJobs).values({
            id,
            type,
            payload: JSON.stringify(payload),
            status: 'pending',
            attempts: 0,
            maxRetries,
            createdAt: now,
            updatedAt: now,
            nextRetryAt: options?.delay !== undefined ? now + options.delay : now,
        });

        return id;
    }

    async enqueueBatch(jobs: Array<{ type: string; payload: unknown } & EnqueueOptions>): Promise<string[]> {
        const now = nowMs();
        const ids: string[] = [];

        const rows = jobs.map((job) => {
            const id = crypto.randomUUID();
            ids.push(id);

            return {
                id,
                type: job.type,
                payload: JSON.stringify(job.payload),
                status: 'pending' as const,
                attempts: 0,
                maxRetries: job.maxRetries ?? 3,
                createdAt: now,
                updatedAt: now,
                nextRetryAt: job.delay !== undefined ? now + job.delay : now,
            };
        });

        if (rows.length > 0) {
            await this.db.insert(queueJobs).values(rows);
        }

        return ids;
    }

    /** Get a job by ID. */
    async get(id: string): Promise<typeof queueJobs.$inferSelect | undefined> {
        const result = await this.db.select().from(queueJobs).where(sql`${queueJobs.id} = ${id}`);

        return result.at(0);
    }
}
