import type { DbClient } from '../db/adapter';
import { QueueJobDao } from '../db/queue-job-dao';
import type { EnqueueOptions, JobQueue } from './types';

/**
 * DB-backed job queue.
 *
 * Enqueues jobs into the `queue_jobs` table via QueueJobDao.
 * Works with any DB adapter (bun-sqlite, D1, etc.) through drizzle-orm.
 */
export class DBJobQueue implements JobQueue {
    private readonly dao: QueueJobDao;

    constructor(db: DbClient) {
        this.dao = new QueueJobDao(db);
    }

    async enqueue(type: string, payload: unknown, options?: EnqueueOptions): Promise<string> {
        return this.dao.enqueue(type, payload, {
            ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
            ...(options?.delay !== undefined && { delay: options.delay }),
        });
    }

    async enqueueBatch(jobs: Array<{ type: string; payload: unknown } & EnqueueOptions>): Promise<string[]> {
        return this.dao.enqueueBatch(jobs);
    }

    /** Get a job by ID. */
    async get(id: string) {
        return this.dao.getById(id);
    }
}
