/// <reference types="@cloudflare/workers-types" />
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import type { DbAdapter, DbClient } from '../adapter';
import * as schema from '../schema';

export class D1Adapter implements DbAdapter {
    private binding: D1Database;
    private drizzleDb: DrizzleD1Database<typeof schema>;

    constructor(binding: D1Database) {
        this.binding = binding;
        this.drizzleDb = drizzle(binding, { schema });
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
