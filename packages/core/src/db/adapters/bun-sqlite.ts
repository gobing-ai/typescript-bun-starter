import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import type { Database as AppDatabase, DbAdapter } from "../adapter";
import * as schema from "../schema";

const PRAGMA_WAL = "PRAGMA journal_mode = WAL";
const PRAGMA_SYNC = "PRAGMA synchronous = NORMAL";
const PRAGMA_FK = "PRAGMA foreign_keys = ON";

export class BunSqliteAdapter implements DbAdapter {
  private sqlite: Database;
  private drizzleDb: BunSQLiteDatabase<typeof schema>;

  constructor(url?: string) {
    this.sqlite = new Database(url ?? process.env.DATABASE_URL ?? "data/app.db", {
      create: true,
    });

    this.sqlite.run(PRAGMA_WAL);
    this.sqlite.run(PRAGMA_SYNC);
    this.sqlite.run(PRAGMA_FK);

    this.drizzleDb = drizzle({ client: this.sqlite, schema });
  }

  getDb(): AppDatabase {
    return this.drizzleDb;
  }

  close(): void {
    this.sqlite.close();
  }
}
