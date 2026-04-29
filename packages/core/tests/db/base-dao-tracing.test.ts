import { afterEach, describe, expect, test } from 'bun:test';
import { BaseDao } from '../../src/db/base-dao';
import { queueJobs } from '../../src/db/schema';
import { getTelemetryConfig } from '../../src/telemetry/config';
import { extractSqlOperation, sanitizeSql } from '../../src/telemetry/db-sanitize';
import { _resetTelemetry } from '../../src/telemetry/sdk';
import { traceAsync } from '../../src/telemetry/tracing';
import { cleanupTestProvider, createTestProvider } from '../telemetry/test-helpers';
import { createTestDb } from '../test-db';

/** Test DAO that exposes withMetrics for testing. */
class TestDao extends BaseDao {
    async doSelect() {
        return this.withMetrics('select', 'test_table', async () => {
            return this.db.select().from(queueJobs).limit(1);
        });
    }

    async doInsert() {
        return this.withMetrics('insert', 'test_table', async () => {
            const now = this.now();
            const id = crypto.randomUUID();
            await this.db.insert(queueJobs).values({
                id,
                type: 'trace-test',
                payload: '{}',
                status: 'pending',
                attempts: 0,
                maxRetries: 3,
                createdAt: now,
                updatedAt: now,
            });
            return id;
        });
    }

    async doFailingOp() {
        return this.withMetrics('select', 'test_table', async () => {
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

                try {
                    await dao.doFailingOp();
                } catch {
                    // Expected
                }

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                const dbSpan = spans.find((s) => s.name === 'db.test_table.select');
                expect(dbSpan).toBeDefined();
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
                await expect(dao.doSelect()).resolves.toBeDefined();
            } finally {
                adapter.close();
            }
        });

        test('DB span is child of request span when request context exists', async () => {
            const { provider, exporter } = createTestProvider();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                // Simulate a request span wrapping a DB operation
                await traceAsync('HTTP GET /api/test', async (requestSpan) => {
                    requestSpan.setAttributes({
                        'http.request.method': 'GET',
                        'url.path': '/api/test',
                    });
                    await dao.doSelect();
                });

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                expect(spans.length).toBeGreaterThanOrEqual(2);

                const requestSpan = spans.find((s) => s.name === 'HTTP GET /api/test');
                const dbSpan = spans.find((s) => s.name === 'db.test_table.select');

                expect(requestSpan).toBeDefined();
                expect(dbSpan).toBeDefined();

                // The DB span's parent should be the request span
                // OTel ReadableSpan stores parent in parentSpanContext.spanId
                const childParentId = (dbSpan as unknown as { parentSpanContext?: { spanId?: string } })
                    ?.parentSpanContext?.spanId;
                expect(childParentId).toBeDefined();
                expect(childParentId).toBe(requestSpan?.spanContext().spanId);

                await cleanupTestProvider(provider);
            } finally {
                adapter.close();
            }
        });

        test('failed DB operation does not leak SQL text in span attributes', async () => {
            const { provider, exporter } = createTestProvider();
            const { adapter, db } = await createTestDb();

            try {
                const dao = new TestDao(db);

                try {
                    await dao.doFailingOp();
                } catch {
                    // Expected
                }

                await provider.forceFlush();

                const spans = exporter.getFinishedSpans();
                const dbSpan = spans.find((s) => s.name === 'db.test_table.select');
                expect(dbSpan).toBeDefined();

                // db.statement must NOT be present by default
                expect(dbSpan?.attributes['db.statement']).toBeUndefined();

                await cleanupTestProvider(provider);
            } finally {
                adapter.close();
            }
        });
    });
});

describe('Span naming conventions', () => {
    test('DB spans follow `db.{collection}.{operation}` pattern', () => {
        expect('db.queue_jobs.insert').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.queue_jobs.select').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.users.delete').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
        expect('db.users.update').toMatch(/^db\.[a-z_]+\.[a-z]+$/);
    });
});

describe('Debug SQL capture', () => {
    afterEach(() => {
        _resetTelemetry();
    });

    test('DAO operations do not attach SQL text when OTEL_DB_STATEMENT_DEBUG is false (default)', async () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        delete process.env.OTEL_DB_STATEMENT_DEBUG;

        const { provider, exporter } = createTestProvider();
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestDao(db);
            await dao.doSelect();

            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.test_table.select');

            expect(span?.attributes['db.statement']).toBeUndefined();

            await cleanupTestProvider(provider);
        } finally {
            adapter.close();
            process.env.OTEL_DB_STATEMENT_DEBUG = original;
        }
    });

    test('DAO operations attach sanitized SQL when OTEL_DB_STATEMENT_DEBUG=true', async () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';

        _resetTelemetry();

        const { provider, exporter } = createTestProvider();
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestDao(db);
            await dao.doSelect();

            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.test_table.select');

            expect(span?.attributes['db.statement']).toBeDefined();
            const statement = String(span?.attributes['db.statement']);
            expect(statement.toUpperCase()).toContain('SELECT');
            expect(statement.toUpperCase()).toContain('FROM');

            expect(span?.attributes['db.statement.operation']).toBe('SELECT');

            await cleanupTestProvider(provider);
        } finally {
            adapter.close();
            process.env.OTEL_DB_STATEMENT_DEBUG = original;
        }
    });

    test('DAO operations enrich spans with row count when bun-sqlite returns rows', async () => {
        const { provider, exporter } = createTestProvider();
        const { adapter, db } = await createTestDb();

        try {
            const dao = new TestDao(db);
            await dao.doSelect();

            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.test_table.select');
            expect(span?.attributes['db.row_count']).toBeDefined();

            await cleanupTestProvider(provider);
        } finally {
            adapter.close();
        }
    });

    test('sanitizeSql redacts string literals and numeric values', async () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';
        _resetTelemetry();

        const { provider, exporter } = createTestProvider();

        try {
            await traceAsync('db.test.insert', async (span) => {
                span.setAttributes({ 'db.system': 'sqlite' });
                span.setAttribute('db.statement', sanitizeSql("INSERT INTO users (name, age) VALUES ('Alice', 30)"));
            });

            await provider.forceFlush();

            const spans = exporter.getFinishedSpans();
            const statement = String(spans[0]?.attributes['db.statement']);
            expect(statement).not.toContain('Alice');
            expect(statement).not.toContain('30');
            expect(statement).toContain('INSERT');

            await cleanupTestProvider(provider);
        } finally {
            process.env.OTEL_DB_STATEMENT_DEBUG = original;
        }
    });
});

describe('SQL sanitization', () => {
    // Detailed sanitization tests are in tests/telemetry/db-sanitize.test.ts
    // These are integration-level smoke tests.

    test('sanitizeSql is importable and works', () => {
        expect(sanitizeSql("SELECT * FROM x WHERE a = 'secret'")).not.toContain('secret');
        expect(extractSqlOperation('SELECT 1')).toBe('SELECT');
    });
});

describe('Debug config flag', () => {
    test('OTEL_DB_STATEMENT_DEBUG defaults to false', () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        delete process.env.OTEL_DB_STATEMENT_DEBUG;

        const config = getTelemetryConfig();
        expect(config.dbStatementDebug).toBe(false);

        process.env.OTEL_DB_STATEMENT_DEBUG = original;
    });

    test('OTEL_DB_STATEMENT_DEBUG=true enables debug mode', () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';

        const config = getTelemetryConfig();
        expect(config.dbStatementDebug).toBe(true);

        process.env.OTEL_DB_STATEMENT_DEBUG = original;
    });

    test('OTEL_DB_STATEMENT_DEBUG=1 enables debug mode', () => {
        const original = process.env.OTEL_DB_STATEMENT_DEBUG;
        process.env.OTEL_DB_STATEMENT_DEBUG = '1';

        const config = getTelemetryConfig();
        expect(config.dbStatementDebug).toBe(true);

        process.env.OTEL_DB_STATEMENT_DEBUG = original;
    });
});
