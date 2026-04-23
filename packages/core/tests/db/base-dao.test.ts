import { describe, expect, test } from 'bun:test';
import { BaseDao } from '../../src/db/base-dao';
import { createTestDb } from '../test-db';

class TestDao extends BaseDao {
    getDbInstance() {
        return this.db;
    }

    getTimestamp() {
        return this.now();
    }
}

describe('BaseDao', () => {
    test('stores the injected database and exposes shared helpers to subclasses', async () => {
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestDao(db);
            const before = Date.now();
            const timestamp = dao.getTimestamp();
            const after = Date.now();

            expect(dao.getDbInstance()).toBe(db);
            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        } finally {
            adapter.close();
        }
    });
});
