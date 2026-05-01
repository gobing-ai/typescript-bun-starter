import { describe, expect, test } from 'bun:test';
import { QueueJobDao } from '../../src';
import { createTestDb } from '../test-db';

describe('QueueJobDao.getStats()', () => {
    test('returns zero counts for an empty queue', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);
            const stats = await dao.getStats();

            expect(stats).toEqual({
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
            });
        } finally {
            adapter.close();
        }
    });

    test('returns correct counts for mixed job states', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);

            // Enqueue 3 pending jobs
            await dao.enqueue('type-a', {});
            await dao.enqueue('type-b', {});
            await dao.enqueue('type-c', {});

            // Create 1 processing job
            const procId = await dao.enqueue('type-p', {});
            await dao.markProcessing([procId]);

            // Create 1 completed job
            const doneId = await dao.enqueue('type-d', {});
            await dao.markCompleted(doneId);

            // Create 1 failed job
            const failId = await dao.enqueue('type-e', {});
            await dao.markFailed(failId, 3, 'test failure');

            const stats = await dao.getStats();

            expect(stats.pending).toBe(3);
            expect(stats.processing).toBe(1);
            expect(stats.completed).toBe(1);
            expect(stats.failed).toBe(1);
        } finally {
            adapter.close();
        }
    });

    test('returns fresh counts after state changes', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new QueueJobDao(db);

            const id = await dao.enqueue('type-x', {});

            let stats = await dao.getStats();
            expect(stats.pending).toBe(1);

            await dao.markCompleted(id);

            stats = await dao.getStats();
            expect(stats.pending).toBe(0);
            expect(stats.completed).toBe(1);
        } finally {
            adapter.close();
        }
    });
});
