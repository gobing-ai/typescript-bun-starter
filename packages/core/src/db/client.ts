import { BunSqliteAdapter } from "./adapters/bun-sqlite";

const defaultAdapter = new BunSqliteAdapter();
export const db = defaultAdapter.getDb();
export { defaultAdapter };
