import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { CORE_CONFIG } from '../../config';
import type { DbAdapter, DbClient } from '../adapter';
import * as schema from '../schema';

export class BunSqliteAdapter implements DbAdapter {
    private sqlite: Database;
    private drizzleDb: BunSQLiteDatabase<typeof schema>;

    constructor(url?: string) {
        const dbPath = url ?? process.env.DATABASE_URL ?? CORE_CONFIG.defaultDbPath;

        // Ensure parent directory exists for file-based databases
        if (dbPath !== ':memory:') {
            const dir = dirname(dbPath);
            if (dir && dir !== '.' && !existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        }

        this.sqlite = new Database(dbPath, { create: true });

        this.sqlite.run(CORE_CONFIG.pragmas.journalMode);
        this.sqlite.run(CORE_CONFIG.pragmas.synchronous);
        this.sqlite.run(CORE_CONFIG.pragmas.foreignKeys);

        this.drizzleDb = drizzle({ client: this.sqlite, schema });
    }

    getDb(): DbClient {
        return this.drizzleDb as unknown as DbClient;
    }

    async exec(sql: string): Promise<void> {
        this.sqlite.run(sql);
    }

    async queryFirst<T>(sql: string): Promise<T | undefined> {
        return this.sqlite.query(sql).get() as T | undefined;
    }

    close(): void {
        this.sqlite.close();
    }
}
