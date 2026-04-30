import { describe, expect, test } from 'bun:test';
import { QueueJobDao } from '../../src';
import { createTestDb } from '../test-db';

describe('QueueJobDao', () => {
    test('enqueue creates a pending job', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', { foo: 'bar' });

            expect(id).toBeString();

            const job = await dao.getById(id);
            expect(job).toBeDefined();
            expect(job?.type).toBe('test-job');
            expect(job?.status).toBe('pending');
            expect(job?.attempts).toBe(0);
            expect(job?.maxRetries).toBe(3);
        } finally {
            adapter.close();
        }
    });

    test('enqueueBatch creates multiple jobs', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const ids = await dao.enqueueBatch([
                { type: 'job-a', payload: { a: 1 } },
                { type: 'job-b', payload: { b: 2 }, maxRetries: 5 },
            ]);

            expect(ids).toHaveLength(2);

            const job1 = await dao.getById(ids[0]);
            const job2 = await dao.getById(ids[1]);

            expect(job1?.type).toBe('job-a');
            expect(job2?.type).toBe('job-b');
            expect(job2?.maxRetries).toBe(5);
        } finally {
            adapter.close();
        }
    });

    test('countByStatus returns correct counts', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            await dao.enqueue('job-1', {});
            await dao.enqueue('job-2', {});
            await dao.enqueue('job-3', {});

            expect(await dao.countByStatus('pending')).toBe(3);
            expect(await dao.countByStatus('completed')).toBe(0);
        } finally {
            adapter.close();
        }
    });

    test('markProcessing updates job status', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});

            await dao.markProcessing([id]);

            const job = await dao.getById(id);
            expect(job?.status).toBe('processing');
            expect(job?.processingAt).toBeNumber();
        } finally {
            adapter.close();
        }
    });

    test('markProcessing updates multiple pending jobs with bound ids', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const ids = await dao.enqueueBatch([
                { type: 'batch-job', payload: { index: 1 } },
                { type: 'batch-job', payload: { index: 2 } },
            ]);

            await dao.markProcessing(ids);

            const jobs = await Promise.all(ids.map((id) => dao.getById(id)));
            expect(jobs.map((job) => job?.status)).toEqual(['processing', 'processing']);
            expect(jobs.every((job) => typeof job?.processingAt === 'number')).toBe(true);
        } finally {
            adapter.close();
        }
    });

    test('markProcessing does not reclaim jobs that are no longer pending', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});

            await dao.markCompleted(id);
            await dao.markProcessing([id]);

            const job = await dao.getById(id);
            expect(job?.status).toBe('completed');
            expect(job?.processingAt).toBeNull();
        } finally {
            adapter.close();
        }
    });

    test('markCompleted updates job status', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});
            await dao.markProcessing([id]);
            await dao.markCompleted(id);

            const job = await dao.getById(id);
            expect(job?.status).toBe('completed');
            expect(job?.processingAt).toBeNull();
        } finally {
            adapter.close();
        }
    });

    test('markFailed updates job status and error', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});

            await dao.markFailed(id, 1, 'something broke');

            const job = await dao.getById(id);
            expect(job?.status).toBe('failed');
            expect(job?.attempts).toBe(1);
            expect(job?.lastError).toBe('something broke');
        } finally {
            adapter.close();
        }
    });

    test('markForRetry resets job to pending with backoff', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});
            const nextRetryAt = Date.now() + 5000;

            await dao.markForRetry(id, 1, 'transient error', nextRetryAt);

            const job = await dao.getById(id);
            expect(job?.status).toBe('pending');
            expect(job?.attempts).toBe(1);
            expect(job?.lastError).toBe('transient error');
            expect(job?.nextRetryAt).toBe(nextRetryAt);
        } finally {
            adapter.close();
        }
    });

    test('findPending returns jobs ready for processing', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            await dao.enqueue('job-1', {});
            await dao.enqueue('job-2', {});

            const pending = await dao.findPending(10);
            expect(pending).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });

    test('claimReady marks and returns multiple ready jobs', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const now = Date.now();
            const ids = ['claim-1', 'claim-2', 'claim-3'];
            for (const [index, id] of ids.entries()) {
                await dao.create({
                    id,
                    type: 'claim-job',
                    payload: JSON.stringify({ index: index + 1 }),
                    status: 'pending',
                    attempts: 0,
                    maxRetries: 3,
                    nextRetryAt: now,
                    createdAt: now + index,
                    updatedAt: now + index,
                });
            }

            const claimed = await dao.claimReady(2);

            expect(claimed).toHaveLength(2);
            expect(claimed.map((job) => job.id)).toEqual(ids.slice(0, 2));
            expect(claimed.every((job) => job.status === 'processing')).toBe(true);
            expect(claimed.every((job) => typeof job.processingAt === 'number')).toBe(true);

            const remaining = await dao.getById(ids[2]);
            expect(remaining?.status).toBe('pending');
        } finally {
            adapter.close();
        }
    });

    test('claimReady calls do not overlap claimed job ids', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            await dao.enqueueBatch([
                { type: 'claim-job', payload: { index: 1 } },
                { type: 'claim-job', payload: { index: 2 } },
                { type: 'claim-job', payload: { index: 3 } },
            ]);

            const firstClaim = await dao.claimReady(2);
            const secondClaim = await dao.claimReady(2);
            const firstIds = new Set(firstClaim.map((job) => job.id));

            expect(secondClaim).toHaveLength(1);
            expect(secondClaim.every((job) => !firstIds.has(job.id))).toBe(true);
        } finally {
            adapter.close();
        }
    });

    test('claimReady does not claim delayed jobs before nextRetryAt', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const readyId = await dao.enqueue('ready-job', {});
            const delayedId = await dao.enqueue('delayed-job', {}, { delay: 60_000 });

            const claimed = await dao.claimReady(10);

            expect(claimed.map((job) => job.id)).toEqual([readyId]);

            const delayed = await dao.getById(delayedId);
            expect(delayed?.status).toBe('pending');
        } finally {
            adapter.close();
        }
    });

    test('claimReady returns an empty batch for non-positive batch sizes', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            await dao.enqueue('ready-job', {});

            expect(await dao.claimReady(0)).toEqual([]);
            expect(await dao.claimReady(-1)).toEqual([]);
        } finally {
            adapter.close();
        }
    });

    test('resetStuckJobs resets processing jobs past timeout', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const id = await dao.enqueue('test-job', {});
            await dao.markProcessing([id]);

            // With a very short timeout, the job should be reset
            const count = await dao.resetStuckJobs(0);
            expect(count).toBeGreaterThanOrEqual(1);

            const job = await dao.getById(id);
            expect(job?.status).toBe('pending');
        } finally {
            adapter.close();
        }
    });

    test('list returns paginated results', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            for (let i = 0; i < 5; i++) {
                await dao.enqueue(`job-${i}`, {});
            }

            const page1 = await dao.list({ limit: 2, offset: 0 });
            const page2 = await dao.list({ limit: 2, offset: 2 });

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });
});
