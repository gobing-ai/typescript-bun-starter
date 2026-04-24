/// <reference types="@cloudflare/workers-types" />

export interface DbTable<TSelect, TInsert = TSelect> {
    readonly $inferSelect: TSelect;
    readonly $inferInsert: TInsert;
}

type DbInsertBuilder<TTable extends DbTable<unknown, unknown>> = {
    values(values: TTable['$inferInsert'] | TTable['$inferInsert'][]): PromiseLike<unknown>;
};

type DbSelectFromResult<TTable extends DbTable<unknown, unknown>> = PromiseLike<TTable['$inferSelect'][]> & {
    limit(value: number): DbSelectFromResult<TTable>;
    offset(value: number): DbSelectFromResult<TTable>;
};

type DbSelectBuilder = {
    from<TTable extends DbTable<unknown, unknown>>(table: TTable): DbSelectFromResult<TTable>;
};

export interface DbClient {
    insert<TTable extends DbTable<unknown, unknown>>(table: TTable): DbInsertBuilder<TTable>;
    select(): DbSelectBuilder;
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
