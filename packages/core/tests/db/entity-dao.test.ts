import { describe, expect, test } from 'bun:test';
import { EntityDao } from '../../src/db/entity-dao';
import { queueJobs } from '../../src/db/schema';
import { createTestDb } from '../test-db';

/**
 * Minimal concrete DAO for testing EntityDao generics.
 * Uses the real `queue_jobs` table — no demo fixtures.
 */
class TestJobDao extends EntityDao<typeof queueJobs, typeof queueJobs.id> {
    constructor(db: Parameters<typeof EntityDao.prototype.constructor>[0]) {
        super(db, queueJobs, queueJobs.id, 'queue_jobs');
    }
}

function makeJob(overrides: Record<string, unknown> = {}) {
    return {
        id: crypto.randomUUID(),
        type: 'test-job',
        payload: '{}',
        status: 'pending',
        attempts: 0,
        maxRetries: 3,
        ...overrides,
    };
}

describe('EntityDao (via TestJobDao on queue_jobs)', () => {
    test('create inserts a record with auto-filled timestamps', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            const record = await dao.create(makeJob({ id: 'test-1' }));

            expect(record.id).toBe('test-1');
            expect(record.type).toBe('test-job');
            expect(record.createdAt).toBeNumber();
            expect(record.updatedAt).toBeNumber();
            expect(record.createdAt).toBe(record.updatedAt);
        } finally {
            adapter.close();
        }
    });

    test('findById returns a record by primary key', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'find-1' }));

            const found = await dao.findById('find-1');
            expect(found).toBeDefined();
            expect(found?.id).toBe('find-1');
        } finally {
            adapter.close();
        }
    });

    test('findById returns undefined for non-existent id', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            const found = await dao.findById('nonexistent');
            expect(found).toBeUndefined();
        } finally {
            adapter.close();
        }
    });

    test('findAll returns all records', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'all-1' }));
            await dao.create(makeJob({ id: 'all-2' }));

            const all = await dao.findAll();
            expect(all).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });

    test('update modifies a record and returns updated version', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'upd-1' }));

            const updated = await dao.update('upd-1', { status: 'processing' });
            expect(updated).toBeDefined();
            expect(updated?.status).toBe('processing');
            expect(updated?.updatedAt).toBeNumber();
        } finally {
            adapter.close();
        }
    });

    test('delete removes a record (hard delete)', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'del-1' }));

            await dao.delete('del-1', false);

            const found = await dao.findById('del-1');
            expect(found).toBeUndefined();
        } finally {
            adapter.close();
        }
    });

    test('findBy returns first matching record', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'by-1', type: 'matchable' }));

            const found = await dao.findBy(queueJobs.type, 'matchable');
            expect(found).toBeDefined();
            expect(found?.id).toBe('by-1');
        } finally {
            adapter.close();
        }
    });

    test('findBy returns undefined when no match', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            const found = await dao.findBy(queueJobs.type, 'nonexistent');
            expect(found).toBeUndefined();
        } finally {
            adapter.close();
        }
    });

    test('findAllBy returns all matching records', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'byall-1', type: 'dup-type' }));
            await dao.create(makeJob({ id: 'byall-2', type: 'dup-type' }));
            await dao.create(makeJob({ id: 'byall-3', type: 'other' }));

            const found = await dao.findAllBy(queueJobs.type, 'dup-type');
            expect(found).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });

    test('list returns paginated results', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            for (let i = 0; i < 5; i++) {
                await dao.create(makeJob({ id: `list-${i}`, type: `job-${i}` }));
            }

            const page1 = await dao.list({ limit: 2, offset: 0 });
            const page2 = await dao.list({ limit: 2, offset: 2 });
            const page3 = await dao.list({ limit: 2, offset: 4 });

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
            expect(page3).toHaveLength(1);
        } finally {
            adapter.close();
        }
    });

    test('count returns number of records', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);
            await dao.create(makeJob({ id: 'cnt-1' }));
            await dao.create(makeJob({ id: 'cnt-2' }));

            const count = await dao.count();
            expect(count).toBe(2);
        } finally {
            adapter.close();
        }
    });

    test('withTransaction commits on success', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestJobDao(db);

            const result = await (
                dao as unknown as { withTransaction: (fn: (tx: typeof db) => Promise<string>) => Promise<string> }
            ).withTransaction(async (tx) => {
                await tx.insert(queueJobs).values(makeJob({ id: 'tx-1' }));
                return 'done';
            });
            expect(result).toBe('done');

            const found = await dao.findById('tx-1');
            expect(found).toBeDefined();
            expect(found?.type).toBe('test-job');
        } finally {
            adapter.close();
        }
    });
});
