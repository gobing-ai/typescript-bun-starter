/// <reference types="@cloudflare/workers-types" />

export interface DbTable<TSelect, TInsert = TSelect> {
    readonly $inferSelect: TSelect;
    readonly $inferInsert: TInsert;
}

type DbInsertBuilder<TTable extends DbTable<unknown, unknown>> = {
    values(values: TTable['$inferInsert'] | TTable['$inferInsert'][]): PromiseLike<unknown>;
};

interface DbSelectWhereResult<TTable extends DbTable<unknown, unknown>> extends PromiseLike<TTable['$inferSelect'][]> {
    limit(value: number): DbSelectWhereResult<TTable>;
    offset(value: number): DbSelectWhereResult<TTable>;
    orderBy(column: unknown): DbSelectWhereResult<TTable>;
}

type DbSelectFromResult<TTable extends DbTable<unknown, unknown>> = DbSelectWhereResult<TTable> & {
    where(condition: unknown): DbSelectWhereResult<TTable>;
};

type DbSelectBuilder = {
    from<TTable extends DbTable<unknown, unknown>>(table: TTable): DbSelectFromResult<TTable>;
};

interface DbUpdateResult {
    changes: number;
}

interface DbUpdateBuilder<TTable extends DbTable<unknown, unknown>> {
    set(values: Partial<TTable['$inferInsert']>): { where(condition: unknown): PromiseLike<DbUpdateResult> };
}

export interface DbClient {
    insert<TTable extends DbTable<unknown, unknown>>(table: TTable): DbInsertBuilder<TTable>;
    select(): DbSelectBuilder;
    update<TTable extends DbTable<unknown, unknown>>(table: TTable): DbUpdateBuilder<TTable>;
    delete<TTable extends DbTable<unknown, unknown>>(
        table: TTable,
    ): {
        where(condition: unknown): PromiseLike<DbUpdateResult>;
    };
}

export interface DbAdapter {
    getDb(): DbClient;
    exec(sql: string): Promise<void>;
    queryFirst<T>(sql: string): Promise<T | undefined>;
    close(): void;
}

export type DbAdapterConfig = { driver: 'bun-sqlite'; url?: string } | { driver: 'd1'; binding: D1Database };

export async function createDbAdapter(config: DbAdapterConfig): Promise<DbAdapter> {
    switch (config.driver) {
        case 'bun-sqlite': {
            const { BunSqliteAdapter } = await import('./adapters/bun-sqlite');
            return new BunSqliteAdapter(config.url);
        }
        case 'd1': {
            const { D1Adapter } = await import('./adapters/d1');
            return new D1Adapter(config.binding);
        }
    }
}
