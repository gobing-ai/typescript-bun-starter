/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, test } from 'bun:test';
import { D1Adapter } from '../../src/db/adapters/d1';
import { BaseDao } from '../../src/db/base-dao';
import { queueJobs } from '../../src/db/schema';
import { runWithDbSpan } from '../../src/db/span-context';
import { _resetTelemetry } from '../../src/telemetry/sdk';
import { traceAsync } from '../../src/telemetry/tracing';
import { cleanupTestProvider, createTestProvider } from '../telemetry/test-helpers';

type MockD1CallLog = {
    prepare: string[];
    exec: string[];
    raw: string[];
    run: string[];
    first: string[];
};

function createMockD1Binding() {
    const calls: MockD1CallLog = {
        prepare: [],
        exec: [],
        raw: [],
        run: [],
        first: [],
    };

    const mockBinding = {
        prepare: (query: string) => {
            calls.prepare.push(query);

            return {
                bind: (..._args: unknown[]) => ({
                    all: async <T>() =>
                        ({
                            results: [] as T[],
                            success: true,
                            meta: {},
                        }) as { results: T[]; success: boolean; meta: Record<string, unknown> },
                    run: async <T>() => {
                        calls.run.push(query);
                        return {
                            results: [{ ok: true }] as T[],
                            success: true,
                            meta: {},
                        };
                    },
                    raw: async <T>() => {
                        calls.raw.push(query);
                        return [['skill-1', 'trace-test', null, 1, null, 100, 100]] as T[];
                    },
                    first: async <T>() => {
                        calls.first.push(query);
                        return ({ value: 1 } as T) ?? null;
                    },
                }),
                first: async <T>() => {
                    calls.first.push(query);
                    return ({ value: 1 } as T) ?? null;
                },
            };
        },
        dump: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
        exec: async (query: string): Promise<{ count: number; duration: number }> => {
            calls.exec.push(query);
            return { count: 0, duration: 0 };
        },
        batch: async <T>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }[]> => [],
        withSession: () => mockBinding,
    };

    return {
        binding: mockBinding as unknown as D1Database,
        calls,
    };
}

class TestD1Dao extends BaseDao {
    async doInsert() {
        return this.withMetrics('insert', 'queue_jobs', async () => {
            const now = Date.now();
            return await this.db.insert(queueJobs).values({
                id: 'job-1',
                type: 'trace-test',
                payload: '{}',
                status: 'pending',
                attempts: 0,
                maxRetries: 3,
                createdAt: now,
                updatedAt: now,
            });
        });
    }

    async doSelect() {
        return this.withMetrics('select', 'queue_jobs', async () => {
            return await this.db.select().from(queueJobs);
        });
    }
}

describe('D1 adapter tracing', () => {
    afterEach(() => {
        _resetTelemetry();
        delete process.env.OTEL_DB_STATEMENT_DEBUG;
    });

    test('enriches DAO spans on the Drizzle D1 execution path', async () => {
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';
        const { binding, calls } = createMockD1Binding();
        const adapter = new D1Adapter(binding);
        const dao = new TestD1Dao(adapter.getDb());
        const { provider, exporter } = createTestProvider();

        try {
            await dao.doInsert();
            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.queue_jobs.insert');
            expect(span).toBeDefined();
            expect(span?.attributes['db.statement']).toBeDefined();
            expect(String(span?.attributes['db.statement']).toUpperCase()).toContain('INSERT');
            expect(span?.attributes['db.statement.operation']).toBe('INSERT');
            expect(span?.attributes['db.row_count']).toBe(1);
            expect(calls.prepare.length).toBeGreaterThan(0);
            expect(calls.run.length).toBeGreaterThan(0);
        } finally {
            await cleanupTestProvider(provider);
            adapter.close();
        }
    });

    test('enriches a bound DB span on the queryFirst path', async () => {
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';
        const { binding, calls } = createMockD1Binding();
        const adapter = new D1Adapter(binding);
        const { provider, exporter } = createTestProvider();

        try {
            await traceAsync('db.d1.query-first', async (span) => {
                span.setAttributes({
                    'db.system': 'sqlite',
                    'db.collection': 'queue_jobs',
                    'db.operation': 'select',
                });
                return await runWithDbSpan(
                    span,
                    async () => await adapter.queryFirst<{ value: number }>('select 1 as value'),
                );
            });

            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.d1.query-first');
            expect(span).toBeDefined();
            expect(span?.attributes['db.statement']).toBe('select ? as value');
            expect(span?.attributes['db.statement.operation']).toBe('SELECT');
            expect(span?.attributes['db.row_count']).toBe(1);
            expect(calls.first).toEqual(['select 1 as value']);
        } finally {
            await cleanupTestProvider(provider);
            adapter.close();
        }
    });

    test('enriches DAO select spans on the D1 raw result path', async () => {
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';
        const { binding, calls } = createMockD1Binding();
        const adapter = new D1Adapter(binding);
        const dao = new TestD1Dao(adapter.getDb());
        const { provider, exporter } = createTestProvider();

        try {
            await dao.doSelect();
            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.queue_jobs.select');
            expect(span).toBeDefined();
            expect(span?.attributes['db.statement']).toBeDefined();
            expect(span?.attributes['db.statement.operation']).toBe('SELECT');
            expect(span?.attributes['db.row_count']).toBe(1);
            expect(calls.raw.length).toBeGreaterThan(0);
        } finally {
            await cleanupTestProvider(provider);
            adapter.close();
        }
    });

    test('enriches manual D1 bound statement all() and first() calls when a DB span is bound', async () => {
        process.env.OTEL_DB_STATEMENT_DEBUG = 'true';
        const { binding } = createMockD1Binding();
        const adapter = new D1Adapter(binding);
        const { provider, exporter } = createTestProvider();

        try {
            await traceAsync('db.d1.manual-all', async (span) => {
                span.setAttributes({
                    'db.system': 'sqlite',
                    'db.collection': 'queue_jobs',
                    'db.operation': 'select',
                });
                await runWithDbSpan(span, async () => {
                    const prepared = binding.prepare('select 1 from queue_jobs');
                    await prepared.bind().all();
                    await prepared.bind().first?.();
                });
            });

            await provider.forceFlush();

            const span = exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.d1.manual-all');
            expect(span).toBeDefined();
            expect(span?.attributes['db.statement']).toBe('select ? from queue_jobs');
            expect(span?.attributes['db.statement.operation']).toBe('SELECT');
            expect(span?.attributes['db.row_count']).toBe(1);
        } finally {
            await cleanupTestProvider(provider);
            adapter.close();
        }
    });
});
