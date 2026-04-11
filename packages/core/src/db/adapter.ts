/// <reference types="@cloudflare/workers-types" />
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./schema";

export type Database = BunSQLiteDatabase<typeof schema> | DrizzleD1Database<typeof schema>;

export interface DbAdapter {
  getDb(): Database;
  close(): void;
}

export type DbAdapterConfig =
  | { driver: "bun-sqlite"; url?: string }
  | { driver: "d1"; binding: D1Database };

export async function createDbAdapter(config: DbAdapterConfig): Promise<DbAdapter> {
  switch (config.driver) {
    case "bun-sqlite": {
      const { BunSqliteAdapter } = await import("./adapters/bun-sqlite");
      return new BunSqliteAdapter(config.url);
    }
    case "d1": {
      const { D1Adapter } = await import("./adapters/d1");
      return new D1Adapter(config.binding);
    }
  }
}
