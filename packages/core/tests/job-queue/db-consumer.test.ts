import { afterEach, describe, expect, it } from 'bun:test';
import type { DbClient } from '../../src/db/adapter';
import { queueJobs } from '../../src/db/schema';
import { DBQueueConsumer } from '../../src/job-queue/db-consumer';
import { DBJobQueue } from '../../src/job-queue/db-queue';
import type { Job, QueueConsumerConfig } from '../../src/job-queue/types';
import { createTestDb } from '../test-db';

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await fn()) return;
        await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Timeout waiting for condition');
}

describe('DBQueueConsumer', () => {
    let db: DbClient;
    let consumer: DBQueueConsumer;
    let queue: DBJobQueue;

    afterEach(async () => {
        try {
            await consumer?.stop();
        } catch {
            // ignore cleanup errors
        }
    });

    async function setup(config?: QueueConsumerConfig) {
        const { db: testDb } = await createTestDb();
        db = testDb;
        queue = new DBJobQueue(db);
        consumer = new DBQueueConsumer(db, { pollInterval: 50, ...config });
    }

    // ── Constructor ────────────────────────────────────────────────────

    it('uses default config values', async () => {
        await setup();
        // Defaults are set internally; verify by checking no crash on start
        await consumer.start();
        await consumer.stop();
    });

    it('accepts custom config values', async () => {
        await setup({
            pollInterval: 100,
            batchSize: 5,
            visibilityTimeout: 60000,
            baseDelay: 2000,
            maxDelay: 120000,
        });
        await consumer.start();
        await consumer.stop();
    });

    // ── Handler Registration ───────────────────────────────────────────

    it('register throws on duplicate type', async () => {
        await setup();
        const handler = async (_job: Job) => {};

        consumer.register('email', handler);
        expect(() => consumer.register('email', handler)).toThrow('Handler already registered for job type "email"');
    });

    // ── Stats ──────────────────────────────────────────────────────────

    it('stats returns zeros when queue is empty', async () => {
        await setup();
        const stats = await consumer.stats();
        expect(stats).toEqual({ pending: 0, processing: 0, completed: 0, failed: 0 });
    });

    // ── Job Processing ─────────────────────────────────────────────────

    it('processes a job successfully', async () => {
        await setup();
        const processed: string[] = [];

        consumer.register('greet', async (job: Job) => {
            processed.push((job.payload as { name: string }).name);
        });

        await consumer.start();
        const id = await queue.enqueue('greet', { name: 'world' });

        await waitFor(async () => {
            const job = await queue.get(id);
            return job?.status === 'completed';
        });

        expect(processed).toEqual(['world']);

        const stats = await consumer.stats();
        expect(stats.completed).toBe(1);
    });

    it('retries a failing job with backoff', async () => {
        await setup({ baseDelay: 10, maxDelay: 50 });
        const attempts: number[] = [];

        consumer.register('flaky', async (job: Job) => {
            attempts.push(job.attempts);
            if (job.attempts < 2) throw new Error('not yet');
        });

        await consumer.start();
        const id = await queue.enqueue('flaky', { x: 1 }, { maxRetries: 3 });

        await waitFor(async () => {
            const job = await queue.get(id);
            return job?.status === 'completed';
        });

        expect(attempts).toEqual([0, 1, 2]);
    });

    it('fails a job after max retries exhausted', async () => {
        await setup({ baseDelay: 10, maxDelay: 50 });

        consumer.register('doomed', async () => {
            throw new Error('always fails');
        });

        await consumer.start();
        const id = await queue.enqueue('doomed', { x: 1 }, { maxRetries: 2 });

        await waitFor(async () => {
            const job = await queue.get(id);
            return job?.status === 'failed';
        });

        const job = await queue.get(id);
        expect(job?.status).toBe('failed');
        expect(job?.attempts).toBe(2);
        expect(job?.lastError).toBe('always fails');
    });

    it('fails job with unknown type immediately', async () => {
        await setup({ baseDelay: 10, maxDelay: 50 });

        await consumer.start();
        const id = await queue.enqueue('no-handler', { x: 1 });

        await waitFor(async () => {
            const job = await queue.get(id);
            return job?.status === 'failed';
        });

        const job = await queue.get(id);
        expect(job?.status).toBe('failed');
        expect(job?.lastError).toContain('No handler registered');
    });

    // ── Stuck Job Recovery ─────────────────────────────────────────────

    it('resets stuck processing jobs to pending', async () => {
        await setup({ visibilityTimeout: 100, pollInterval: 200 });

        consumer.register('stuck-task', async () => {});

        // Insert a job stuck in "processing" with old processingAt
        const oldTime = Date.now() - 5000;
        const stuckId = crypto.randomUUID();
        await db.insert(queueJobs).values({
            id: stuckId,
            type: 'stuck-task',
            payload: '{}',
            status: 'processing',
            attempts: 1,
            maxRetries: 3,
            createdAt: oldTime - 10000,
            updatedAt: oldTime,
            processingAt: oldTime,
        });

        await consumer.start();

        // The stuck job should be reset and then processed
        await waitFor(async () => {
            const job = await queue.get(stuckId);
            return job?.status === 'completed';
        });

        const job = await queue.get(stuckId);
        expect(job?.status).toBe('completed');
        expect(job?.processingAt).toBeNull();
    });

    // ── Stop ────────────────────────────────────────────────────────────

    it('stop cancels the polling loop', async () => {
        await setup();

        consumer.register('task', async () => {});
        await consumer.start();
        await consumer.stop();

        // Enqueue a job after stop — it should stay pending
        const id = await queue.enqueue('task', { x: 1 });

        // Give it time; consumer should not process after stop
        await new Promise((r) => setTimeout(r, 150));

        const job = await queue.get(id);
        expect(job?.status).toBe('pending');
    });

    it('double stop is safe', async () => {
        await setup();
        await consumer.start();
        await consumer.stop();
        await consumer.stop(); // should not throw
    });

    it('start after restart processes jobs', async () => {
        await setup();

        const processed: string[] = [];
        consumer.register('note', async (job: Job) => {
            processed.push((job.payload as { msg: string }).msg);
        });

        await consumer.start();
        await consumer.stop();

        // Restart
        await consumer.start();
        const id = await queue.enqueue('note', { msg: 'hello' });

        await waitFor(async () => {
            const job = await queue.get(id);
            return job?.status === 'completed';
        });

        expect(processed).toEqual(['hello']);
    });

    // ── Stats After Processing ─────────────────────────────────────────

    it('stats reflects queue state after mixed outcomes', async () => {
        await setup({ baseDelay: 10, maxDelay: 50 });

        const completed: string[] = [];
        consumer.register('ok', async (job: Job) => {
            completed.push(job.id);
        });
        consumer.register('bad', async () => {
            throw new Error('fail');
        });

        await consumer.start();

        await queue.enqueue('ok', { x: 1 });
        await queue.enqueue('ok', { x: 2 });
        await queue.enqueue('bad', { x: 3 }, { maxRetries: 1 });

        await waitFor(async () => {
            const stats = await consumer.stats();
            return stats.completed >= 2 && stats.failed >= 1;
        });

        const stats = await consumer.stats();
        expect(stats.completed).toBeGreaterThanOrEqual(2);
        expect(stats.failed).toBeGreaterThanOrEqual(1);
    });
});
