/// <reference types="@cloudflare/workers-types" />
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import type { Database as AppDatabase, DbAdapter } from '../adapter';
import * as schema from '../schema';

export class D1Adapter implements DbAdapter {
    private drizzleDb: DrizzleD1Database<typeof schema>;

    constructor(binding: D1Database) {
        this.drizzleDb = drizzle(binding, { schema });
    }

    getDb(): AppDatabase {
        return this.drizzleDb;
    }

    close(): void {
        // D1 bindings are managed by the Workers runtime -- no-op
    }
}
