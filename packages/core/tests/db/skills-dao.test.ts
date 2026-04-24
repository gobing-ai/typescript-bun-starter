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

    test('listSkills honors limit and offset', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            for (let i = 0; i < 5; i++) {
                await dao.createSkill({ name: `skill-${i}` });
            }

            const firstPage = await dao.listSkills({ limit: 2 });
            const secondPage = await dao.listSkills({ limit: 2, offset: 2 });
            const thirdPage = await dao.listSkills({ limit: 2, offset: 4 });

            expect(firstPage).toHaveLength(2);
            expect(secondPage).toHaveLength(2);
            expect(thirdPage).toHaveLength(1);

            const allNames = [...firstPage, ...secondPage, ...thirdPage].map((r) => r.name);
            expect(new Set(allNames).size).toBe(5);
        } finally {
            adapter.close();
        }
    });

    test('listSkills clamps oversized limit to MAX_LIST_SKILLS_LIMIT', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.createSkill({ name: 'only-one' });

            // Asking for far more than the cap is clamped silently — query succeeds.
            const rows = await dao.listSkills({ limit: 10_000 });
            expect(rows).toHaveLength(1);
        } finally {
            adapter.close();
        }
    });

    test('listSkills clamps negative limit/offset to safe values', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new SkillsDao(db);
            await dao.createSkill({ name: 'a' });
            await dao.createSkill({ name: 'b' });

            const rows = await dao.listSkills({ limit: -5, offset: -10 });
            expect(rows).toHaveLength(1); // limit clamped to 1, offset to 0
        } finally {
            adapter.close();
        }
    });
});
