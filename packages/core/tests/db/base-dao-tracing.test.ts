import { afterEach, describe, expect, test } from 'bun:test';
import { BaseDao } from '../../src/db/base-dao';
import { skills } from '../../src/db/schema';
import { _resetTelemetry } from '../../src/telemetry/sdk';
import { cleanupTestProvider, createTestProvider } from '../telemetry/test-helpers';
import { createTestDb } from '../test-db';

/** Test DAO that exposes withMetrics for testing. */
class TestDao extends BaseDao {
    async doSelect() {
        return this.withMetrics('select', 'test_table', async () => {
            return this.db.select().from(skills).limit(1);
        });
    }

    async doInsert() {
        return this.withMetrics('insert', 'test_table', async () => {
            const now = this.now();
            const id = crypto.randomUUID();
            await this.db.insert(skills).values({
                id,
                name: 'trace-test',
                description: null,
                version: 1,
                config: null,
                createdAt: now,
                updatedAt: now,
            });
            return id;
        });
    }

    async doFailingOp() {
        return this.withMetrics('select', 'test_table', async () => {
            // Intentionally throw an error to test span error status
            throw new Error('Intentional test error');
        });
    }
}

describe('BaseDao tracing', () => {
    afterEach(() => {
        _resetTelemetry();
    });

    describe('withMetrics', () => {
        test('creates a span following naming convention `db.{collection}.{operation}`', async () => {
            const { provider, exporter } = createTestProvider();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                await dao.doSelect();

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                expect(spans.length).toBeGreaterThanOrEqual(1);

                // Find the DB span
                const dbSpan = spans.find((s) => s.name.startsWith('db.'));
                expect(dbSpan).toBeDefined();
                expect(dbSpan?.name).toBe('db.test_table.select');

                await cleanupTestProvider(provider);
            } finally {
                adapter.close();
            }
        });

        test('sets db.system, db.operation, and db.collection attributes', async () => {
            const { provider, exporter } = createTestProvider();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                await dao.doInsert();

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                const dbSpan = spans.find((s) => s.name === 'db.test_table.insert');
                expect(dbSpan).toBeDefined();
                expect(dbSpan?.attributes['db.system']).toBe('sqlite');
                expect(dbSpan?.attributes['db.operation']).toBe('insert');
                expect(dbSpan?.attributes['db.collection']).toBe('test_table');

                await cleanupTestProvider(provider);
            } finally {
                adapter.close();
            }
        });

        test('records error status when operation throws', async () => {
            const { provider, exporter } = createTestProvider();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                // doFailingOp will throw an error which traceAsync should capture
                try {
                    await dao.doFailingOp();
                } catch {
                    // Expected - we verify the span captured the error
                }

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                const dbSpan = spans.find((s) => s.name === 'db.test_table.select');
                expect(dbSpan).toBeDefined();
                // When traceAsync catches an exception, it sets span status to ERROR
                // The span status code 2 = ERROR in OpenTelemetry
                expect(dbSpan?.status.code).toBe(2);

                await cleanupTestProvider(provider);
            } finally {
                adapter.close();
            }
        });

        test('is a no-op when no telemetry provider is registered', async () => {
            _resetTelemetry();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                // Should not throw even without a provider
                // The select will work but span will be no-op
                await expect(dao.doSelect()).resolves.toBeDefined();
            } finally {
                adapter.close();
            }
        });
    });
});

describe('Span naming conventions', () => {
    test('DB spans follow `db.{collection}.{operation}` pattern', () => {
        // This documents the expected naming convention
        expect('db.skills.insert').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.skills.select').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.users.delete').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.users.update').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
    });
});
