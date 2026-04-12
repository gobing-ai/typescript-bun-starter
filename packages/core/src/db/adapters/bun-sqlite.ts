import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { CORE_CONFIG } from "../../config";
import type { Database as AppDatabase, DbAdapter } from "../adapter";
import * as schema from "../schema";

export class BunSqliteAdapter implements DbAdapter {
  private sqlite: Database;
  private drizzleDb: BunSQLiteDatabase<typeof schema>;

  constructor(url?: string) {
    const dbPath = url ?? process.env.DATABASE_URL ?? CORE_CONFIG.defaultDbPath;

    // Ensure parent directory exists for file-based databases
    if (dbPath !== ":memory:") {
      const dir = dirname(dbPath);
      if (dir && dir !== "." && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.sqlite = new Database(dbPath, { create: true });

    this.sqlite.run(CORE_CONFIG.pragmas.journalMode);
    this.sqlite.run(CORE_CONFIG.pragmas.synchronous);
    this.sqlite.run(CORE_CONFIG.pragmas.foreignKeys);

    this.drizzleDb = drizzle({ client: this.sqlite, schema });
  }

  getDb(): AppDatabase {
    return this.drizzleDb;
  }

  close(): void {
    this.sqlite.close();
  }
}
