import { describe, expect, test } from 'bun:test';
import { SkillsDao } from '../../src';
import { skills } from '../../src/db/schema';
import { createTestDb } from '../test-db';

describe('EntityDao (via SkillsDao)', () => {
    test('create inserts a record with auto-filled timestamps', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            const record = await dao.create({
                id: 'test-1',
                name: 'entity-skill',
            });

            expect(record.id).toBe('test-1');
            expect(record.name).toBe('entity-skill');
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
            const dao = new SkillsDao(db);
            await dao.create({ id: 'find-1', name: 'findable' });

            const found = await dao.findById('find-1');
            expect(found).toBeDefined();
            expect(found?.id).toBe('find-1');
            expect(found?.name).toBe('findable');
        } finally {
            adapter.close();
        }
    });

    test('findById returns undefined for non-existent id', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            const found = await dao.findById('nonexistent');
            expect(found).toBeUndefined();
        } finally {
            adapter.close();
        }
    });

    test('findAll returns all records', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.create({ id: 'all-1', name: 'first' });
            await dao.create({ id: 'all-2', name: 'second' });

            const all = await dao.findAll();
            expect(all).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });

    test('update modifies a record and returns updated version', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.create({ id: 'upd-1', name: 'original' });

            const updated = await dao.update('upd-1', { name: 'modified' });
            expect(updated).toBeDefined();
            expect(updated?.name).toBe('modified');
            expect(updated?.updatedAt).toBeNumber();
        } finally {
            adapter.close();
        }
    });

    test('delete removes a record (hard delete)', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.create({ id: 'del-1', name: 'deletable' });

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
            const dao = new SkillsDao(db);
            await dao.create({ id: 'by-1', name: 'matchable' });

            const found = await dao.findBy(skills.name, 'matchable');
            expect(found).toBeDefined();
            expect(found?.id).toBe('by-1');
        } finally {
            adapter.close();
        }
    });

    test('findBy returns undefined when no match', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            const found = await dao.findBy(skills.name, 'nonexistent');
            expect(found).toBeUndefined();
        } finally {
            adapter.close();
        }
    });

    test('findAllBy returns all matching records', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.create({ id: 'byall-1', name: 'dup-name' });
            await dao.create({ id: 'byall-2', name: 'dup-name' });
            await dao.create({ id: 'byall-3', name: 'other' });

            const found = await dao.findAllBy(skills.name, 'dup-name');
            expect(found).toHaveLength(2);
        } finally {
            adapter.close();
        }
    });

    test('list returns paginated results', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            for (let i = 0; i < 5; i++) {
                await dao.create({ id: `list-${i}`, name: `skill-${i}` });
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
            const dao = new SkillsDao(db);
            await dao.create({ id: 'cnt-1', name: 'a' });
            await dao.create({ id: 'cnt-2', name: 'b' });

            const count = await dao.count();
            expect(count).toBe(2);
        } finally {
            adapter.close();
        }
    });

    test('withTransaction commits on success', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);

            // Use the protected withTransaction via a subclass
            class TestDao extends SkillsDao {
                async createInTransaction() {
                    return this.withTransaction(async (tx) => {
                        // Insert via the transaction client
                        await tx.insert(skills).values({
                            id: 'tx-1',
                            name: 'in-tx',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        });
                        return 'done';
                    });
                }
            }

            const testDao = new TestDao(db);
            const result = await testDao.createInTransaction();
            expect(result).toBe('done');

            const found = await dao.findById('tx-1');
            expect(found).toBeDefined();
            expect(found?.name).toBe('in-tx');
        } finally {
            adapter.close();
        }
    });
});
