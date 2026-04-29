import { describe, expect, it } from 'bun:test';
import type { DbClient } from '../../src/db/adapter';
import { DBJobQueue } from '../../src/job-queue/db-queue';
import { createTestDb } from '../test-db';

describe('DBJobQueue', () => {
    let db: DbClient;
    let queue: DBJobQueue;

    async function setup() {
        const { db: testDb } = await createTestDb();
        db = testDb;
        queue = new DBJobQueue(db);
    }

    it('enqueue creates a job and returns an ID', async () => {
        await setup();

        const id = await queue.enqueue('send-email', { to: 'a@b.com' });
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);

        const job = await queue.get(id);
        expect(job).toBeDefined();
        expect(job?.type).toBe('send-email');
        expect(job?.status).toBe('pending');
        expect(job?.attempts).toBe(0);
        expect(job?.maxRetries).toBe(3);
        expect(JSON.parse(job?.payload)).toEqual({ to: 'a@b.com' });
    });

    it('enqueueBatch creates multiple jobs', async () => {
        await setup();

        const ids = await queue.enqueueBatch([
            { type: 'email', payload: { id: 1 } },
            { type: 'email', payload: { id: 2 } },
            { type: 'sms', payload: { phone: '123' } },
        ]);

        expect(ids).toHaveLength(3);
        const [id1, id2, id3] = ids as [string, string, string];

        const job1 = await queue.get(id1);
        const job2 = await queue.get(id2);
        const job3 = await queue.get(id3);

        expect(job1?.type).toBe('email');
        expect(job2?.type).toBe('email');
        expect(job3?.type).toBe('sms');
    });

    it('get returns undefined for unknown ID', async () => {
        await setup();

        const job = await queue.get('nonexistent');
        expect(job).toBeUndefined();
    });

    it('enqueue respects maxRetries option', async () => {
        await setup();

        const id = await queue.enqueue('task', { x: 1 }, { maxRetries: 5 });
        const job = await queue.get(id);

        expect(job?.maxRetries).toBe(5);
    });

    it('enqueue sets nextRetryAt based on delay option', async () => {
        await setup();

        const before = Date.now();
        const id = await queue.enqueue('task', { x: 1 }, { delay: 10000 });
        const job = await queue.get(id);

        expect(job?.nextRetryAt).toBeGreaterThanOrEqual(before);
        expect(job?.nextRetryAt).toBeLessThanOrEqual(before + 11000);
    });

    it('enqueue defaults nextRetryAt to now when no delay is set', async () => {
        await setup();

        const before = Date.now();
        const id = await queue.enqueue('task', { x: 1 });
        const job = await queue.get(id);

        expect(job?.nextRetryAt).toBeGreaterThanOrEqual(before - 100);
        expect(job?.nextRetryAt).toBeLessThanOrEqual(before + 100);
    });

    it('enqueueBatch with empty array returns empty result', async () => {
        await setup();

        const ids = await queue.enqueueBatch([]);
        expect(ids).toEqual([]);
    });
});
