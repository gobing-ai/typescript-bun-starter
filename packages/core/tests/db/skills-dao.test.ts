import { describe, expect, test } from 'bun:test';
import { SkillsDao } from '../../src';
import { skills } from '../../src/db/schema';
import { createTestDb } from '../test-db';

describe('SkillsDao', () => {
    test('createSkill inserts a row with defaults and timestamps', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            const created = await dao.createSkill({ name: 'dao-skill' });
            const rows = await db.select().from(skills);

            expect(created.id).toBeString();
            expect(created.name).toBe('dao-skill');
            expect(created.description).toBeNull();
            expect(created.version).toBe(1);
            expect(created.config).toBeNull();
            expect(created.createdAt).toBeNumber();
            expect(created.updatedAt).toBe(created.createdAt);
            expect(rows).toEqual([created]);
        } finally {
            adapter.close();
        }
    });

    test('listSkills returns persisted rows', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.createSkill({ name: 'first-skill' });
            await dao.createSkill({ name: 'second-skill', description: 'listed', version: 2, config: '{}' });

            const rows = await dao.listSkills();

            expect(rows).toHaveLength(2);
            expect(rows.map((row) => row.name)).toEqual(['first-skill', 'second-skill']);
            expect(rows[1]?.description).toBe('listed');
            expect(rows[1]?.version).toBe(2);
            expect(rows[1]?.config).toBe('{}');
        } finally {
            adapter.close();
        }
    });
});
