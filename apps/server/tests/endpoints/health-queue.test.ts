import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { QueueJobDao } from '@starter/core';
import { createTestDb } from '@starter/core/tests/test-db';
import { createApp } from '../../src/index';

beforeAll(() => {
    process.env.AUTH_DISABLED = '1';
});

describe('GET /api/health/queue', () => {
    const cleanupFns: Array<() => void> = [];

    afterEach(() => {
        while (cleanupFns.length > 0) {
            cleanupFns.pop()?.();
        }
    });

    test('returns zero counts for empty queue', async () => {
        const { adapter, db } = await createTestDb();
        cleanupFns.push(() => adapter.close());

        const app = createApp(db);
        const res = await app.request('/api/health/queue');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { code: number; data: Record<string, number> };
        expect(body.code).toBe(0);
        expect(body.data).toEqual({
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        });
    });

    test('returns non-zero counts when jobs exist', async () => {
        const { adapter, db } = await createTestDb();
        cleanupFns.push(() => adapter.close());

        const dao = new QueueJobDao(db);
        await dao.enqueue('email', { to: 'a@b.com' });
        await dao.enqueue('email', { to: 'c@d.com' });

        const app = createApp(db);
        const res = await app.request('/api/health/queue');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { code: number; data: Record<string, number> };
        expect(body.code).toBe(0);
        expect(body.data.pending).toBe(2);
        expect(body.data.processing).toBe(0);
        expect(body.data.completed).toBe(0);
        expect(body.data.failed).toBe(0);
    });
});
