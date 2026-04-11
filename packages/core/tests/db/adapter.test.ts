/// <reference types="@cloudflare/workers-types" />
import { describe, expect, test } from "bun:test";
import { createDbAdapter, type DbAdapterConfig } from "../../src/db/adapter";

describe("createDbAdapter", () => {
  test("creates bun-sqlite adapter", async () => {
    const adapter = await createDbAdapter({ driver: "bun-sqlite", url: ":memory:" });
    expect(adapter).toBeDefined();
    const db = adapter.getDb();
    expect(db).toBeDefined();
    adapter.close();
  });

  test("bun-sqlite adapter with default url", async () => {
    const adapter = await createDbAdapter({ driver: "bun-sqlite" });
    expect(adapter).toBeDefined();
    const db = adapter.getDb();
    expect(db).toBeDefined();
    adapter.close();
  });

  test("creates d1 adapter with mock binding", async () => {
    const stmt = {
      bind: (..._args: unknown[]) => stmt,
      first: async <T>(): Promise<T | null> => null,
      all: async <T>(): Promise<{ results: T[]; success: boolean }> => ({
        results: [],
        success: true,
      }),
      run: async <T>(): Promise<{ results: T[]; success: boolean }> => ({
        results: [],
        success: true,
      }),
      raw: async <T>(): Promise<T[]> => [],
    };

    const mockBinding = {
      prepare: (_query: string) => stmt,
      dump: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
      exec: async (_query: string): Promise<{ count: number; duration: number }> => ({
        count: 0,
        duration: 0,
      }),
      batch: async <T>(): Promise<{ results: T[]; success: boolean }[]> => [],
    };

    const config: DbAdapterConfig = {
      driver: "d1",
      binding: mockBinding as unknown as D1Database,
    };
    const adapter = await createDbAdapter(config);
    expect(adapter).toBeDefined();
    const db = adapter.getDb();
    expect(db).toBeDefined();
    adapter.close();
  });
});
