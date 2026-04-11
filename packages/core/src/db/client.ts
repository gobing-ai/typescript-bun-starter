import type { Database, DbAdapter } from "./adapter";

let _adapter: DbAdapter | undefined;

export function getDefaultAdapter(): DbAdapter {
  if (!_adapter) {
    // Lazy: only connect when first needed
    const { BunSqliteAdapter } =
      require("./adapters/bun-sqlite") as typeof import("./adapters/bun-sqlite");
    _adapter = new BunSqliteAdapter();
  }
  return _adapter;
}

export function getDb(): Database {
  return getDefaultAdapter().getDb();
}
