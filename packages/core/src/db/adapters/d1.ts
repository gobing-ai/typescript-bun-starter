/// <reference types="@cloudflare/workers-types" />
import { trace } from '@opentelemetry/api';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { extractSqlOperation, sanitizeSql } from '../../telemetry/db-sanitize';
import { getResolvedConfig } from '../../telemetry/sdk';
import type { DbAdapter, DbClient } from '../adapter';
import * as schema from '../schema';
import { getCurrentDbSpan } from '../span-context';

type D1ExecutionResult = {
    results?: unknown[];
};

type D1PreparedStatementLike = {
    bind: (...params: unknown[]) => D1BoundStatementLike;
    first?: <T>() => Promise<T | null>;
};

type D1BoundStatementLike = {
    all: <T>() => Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>;
    run: <T>() => Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>;
    raw: <T>() => Promise<T[]>;
    first?: <T>() => Promise<T | null>;
};

type InstrumentableD1 = D1Database & {
    prepare: (sql: string) => D1PreparedStatementLike;
};

function enrichActiveDbSpan(sql: string, result?: unknown): void {
    const span = getCurrentDbSpan() ?? trace.getActiveSpan();
    if (!span?.isRecording()) {
        return;
    }

    const attrs: Record<string, string | number> = {};
    const operation = extractSqlOperation(sql);

    if (Array.isArray(result)) {
        attrs['db.row_count'] = result.length;
    } else if (
        result !== undefined &&
        result !== null &&
        typeof result === 'object' &&
        'results' in result &&
        Array.isArray((result as D1ExecutionResult).results)
    ) {
        attrs['db.row_count'] = (result as D1ExecutionResult).results?.length ?? 0;
    } else if (result !== undefined && result !== null && typeof result === 'object') {
        attrs['db.row_count'] = 1;
    }

    if (getResolvedConfig().dbStatementDebug) {
        attrs['db.statement'] = sanitizeSql(sql);
        if (operation) {
            attrs['db.statement.operation'] = operation;
        }
    }

    span.setAttributes(attrs);
}

function wrapBoundStatement<T extends D1BoundStatementLike>(sql: string, stmt: T): T {
    const originalAll = stmt.all.bind(stmt);
    const originalRun = stmt.run.bind(stmt);
    const originalRaw = stmt.raw.bind(stmt);
    const originalFirst = stmt.first?.bind(stmt);

    stmt.all = (async <TResult>() => {
        const result = await originalAll<TResult>();
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['all'];

    stmt.run = (async <TResult>() => {
        const result = await originalRun<TResult>();
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['run'];

    stmt.raw = (async <TResult>() => {
        const result = await originalRaw<TResult>();
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['raw'];

    if (originalFirst) {
        stmt.first = (async <TResult>() => {
            const result = await originalFirst<TResult>();
            enrichActiveDbSpan(sql, result);
            return result;
        }) as NonNullable<T['first']>;
    }

    return stmt;
}

function wrapPreparedStatement<T extends D1PreparedStatementLike>(sql: string, stmt: T): T {
    const originalBind = stmt.bind.bind(stmt);
    const originalFirst = stmt.first?.bind(stmt);

    stmt.bind = ((...params: unknown[]) => {
        const bound = originalBind(...params);
        return wrapBoundStatement(sql, bound);
    }) as T['bind'];

    if (originalFirst) {
        stmt.first = (async <TResult>() => {
            const result = await originalFirst<TResult>();
            enrichActiveDbSpan(sql, result);
            return result;
        }) as NonNullable<T['first']>;
    }

    return stmt;
}

function instrumentD1Binding(binding: D1Database): D1Database {
    const client = binding as InstrumentableD1;
    if (typeof client.prepare !== 'function') {
        return binding;
    }

    const originalPrepare = client.prepare.bind(client) as InstrumentableD1['prepare'];

    client.prepare = ((sql: string) => {
        return wrapPreparedStatement(sql, originalPrepare(sql));
    }) as InstrumentableD1['prepare'];

    return client;
}

export class D1Adapter implements DbAdapter {
    private binding: D1Database;
    private drizzleDb: DrizzleD1Database<typeof schema>;

    constructor(binding: D1Database) {
        this.binding = instrumentD1Binding(binding);
        this.drizzleDb = drizzle(this.binding, { schema });
    }

    getDb(): DbClient {
        return this.drizzleDb as unknown as DbClient;
    }

    async exec(sql: string): Promise<void> {
        await this.binding.exec(sql);
    }

    async queryFirst<T>(sql: string): Promise<T | undefined> {
        return (await this.binding.prepare(sql).first<T>()) ?? undefined;
    }

    close(): void {
        // D1 bindings are managed by the Workers runtime -- no-op
    }
}
