import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { trace } from '@opentelemetry/api';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { CORE_CONFIG } from '../../config';
import { extractSqlOperation, sanitizeSql } from '../../telemetry/db-sanitize';
import { getResolvedConfig } from '../../telemetry/sdk';
import type { DbAdapter, DbClient } from '../adapter';
import * as schema from '../schema';
import { getCurrentDbSpan } from '../span-context';

type SqliteStatementLike = {
    all: (...params: unknown[]) => unknown;
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
    values?: (...params: unknown[]) => unknown;
};

type InstrumentableSqlite = Database & {
    prepare: (sql: string, ...rest: unknown[]) => SqliteStatementLike;
    query: (sql: string, ...rest: unknown[]) => SqliteStatementLike;
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

function wrapStatement<T extends SqliteStatementLike>(sql: string, stmt: T): T {
    const originalAll = stmt.all.bind(stmt);
    const originalGet = stmt.get.bind(stmt);
    const originalRun = stmt.run.bind(stmt);
    const originalValues = stmt.values?.bind(stmt);

    stmt.all = ((...params: unknown[]) => {
        const result = originalAll(...params);
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['all'];

    stmt.get = ((...params: unknown[]) => {
        const result = originalGet(...params);
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['get'];

    stmt.run = ((...params: unknown[]) => {
        const result = originalRun(...params);
        enrichActiveDbSpan(sql, result);
        return result;
    }) as T['run'];

    if (originalValues) {
        stmt.values = ((...params: unknown[]) => {
            const result = originalValues(...params);
            enrichActiveDbSpan(sql, result);
            return result;
        }) as NonNullable<T['values']>;
    }

    return stmt;
}

function instrumentDatabaseClient(sqlite: Database): Database {
    const client = sqlite as InstrumentableSqlite;
    const originalPrepare = client.prepare.bind(client) as InstrumentableSqlite['prepare'];
    const originalQuery = client.query.bind(client) as InstrumentableSqlite['query'];

    client.prepare = ((...args: Parameters<InstrumentableSqlite['prepare']>) => {
        const [sql] = args;
        return wrapStatement(sql, originalPrepare(...args));
    }) as InstrumentableSqlite['prepare'];

    client.query = ((...args: Parameters<InstrumentableSqlite['query']>) => {
        const [sql] = args;
        return wrapStatement(sql, originalQuery(...args));
    }) as InstrumentableSqlite['query'];

    return client;
}

export class BunSqliteAdapter implements DbAdapter {
    private sqlite: Database;
    private drizzleDb: BunSQLiteDatabase<typeof schema>;

    constructor(url?: string) {
        const dbPath = url ?? process.env.DATABASE_URL ?? CORE_CONFIG.defaultDbPath;

        // Ensure parent directory exists for file-based databases
        if (dbPath !== ':memory:') {
            const dir = dirname(dbPath);
            if (dir && dir !== '.') {
                mkdirSync(dir, { recursive: true });
            }
        }

        this.sqlite = new Database(dbPath, { create: true });

        this.sqlite.run(CORE_CONFIG.pragmas.journalMode);
        this.sqlite.run(CORE_CONFIG.pragmas.synchronous);
        this.sqlite.run(CORE_CONFIG.pragmas.foreignKeys);

        this.drizzleDb = drizzle({ client: instrumentDatabaseClient(this.sqlite), schema });
    }

    getDb(): DbClient {
        return this.drizzleDb as unknown as DbClient;
    }

    /** Returns the underlying drizzle instance for migration operations. */
    getDrizzleDb(): BunSQLiteDatabase<typeof schema> {
        return this.drizzleDb;
    }

    async exec(sql: string): Promise<void> {
        // Route through the instrumented prepare path so DDL/raw statements
        // emit the same span enrichment as ORM-issued queries. Database.run
        // is not wrapped by instrumentDatabaseClient, so calling it directly
        // would silently bypass telemetry.
        this.sqlite.prepare(sql).run();
    }

    async queryFirst<T>(sql: string): Promise<T | undefined> {
        return this.sqlite.query(sql).get() as T | undefined;
    }

    close(): void {
        this.sqlite.close();
    }
}
