#!/usr/bin/env bun
/**
 * Remove the "skills" demo domain, leaving a clean starter skeleton.
 *
 * Usage: bun run clean-demo
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

// ---------------------------------------------------------------------------
// Files to delete entirely
// ---------------------------------------------------------------------------
const DELETE_FILES: string[] = [
    // Core — skill domain
    'packages/core/src/schemas/skill.ts',
    'packages/core/src/services/skill-service.ts',
    'packages/core/tests/services/skill-service.test.ts',

    // CLI — skill commands + tests
    'apps/cli/src/commands/skill-create.ts',
    'apps/cli/src/commands/skill-delete.ts',
    'apps/cli/src/commands/skill-get.ts',
    'apps/cli/src/commands/skill-list.ts',
    'apps/cli/tests/commands/skill-create.test.ts',
    'apps/cli/tests/commands/skill-delete.test.ts',
    'apps/cli/tests/commands/skill-get.test.ts',
    'apps/cli/tests/commands/skill-list.test.ts',

    // Server — skill routes + tests
    'apps/server/src/routes/skills.ts',
    'apps/server/tests/routes/skills.test.ts',
];

// ---------------------------------------------------------------------------
// File rewrites — strip skill references
// ---------------------------------------------------------------------------
const REWRITES: Record<string, string> = {
    // packages/core/src/db/schema.ts — empty schema file (must be a valid module)
    'packages/core/src/db/schema.ts': `// Add your Drizzle table definitions here.\nexport {};\n`,

    // packages/core/src/config.ts — remove skill constraints
    'packages/core/src/config.ts': `/**
 * Core package configuration.
 *
 * Compile-time constants and runtime defaults for @project/core.
 */
export const CORE_CONFIG = {
  /** Default SQLite database path when DATABASE_URL is not set */
  defaultDbPath: "data/app.db",

  /** SQLite pragmas applied on connection */
  pragmas: {
    journalMode: "PRAGMA journal_mode = WAL",
    synchronous: "PRAGMA synchronous = NORMAL",
    foreignKeys: "PRAGMA foreign_keys = ON",
  },
} as const;
`,

    // packages/core/src/index.ts — remove skill exports
    'packages/core/src/index.ts': `// @project/core — barrel export

// Config
export { CORE_CONFIG } from "./config";
export type { Database, DbAdapter, DbAdapterConfig } from "./db/adapter";
export { createDbAdapter } from "./db/adapter";
// Database
export { _resetAdapter, getDb, getDefaultAdapter } from "./db/client";
export type { ErrorCode } from "./errors";
// Errors
export {
  AppError,
  ConflictError,
  InternalError,
  isAppError,
  NotFoundError,
  ValidationError,
} from "./errors";
// Logger
export { logger } from "./logger";
export { getLoggerConfig } from "./logging";
// Types
export type { Result } from "./types/result";
`,

    // apps/cli/src/index.ts — remove skill commands
    'apps/cli/src/index.ts': `#!/usr/bin/env bun
import { Writable } from "node:stream";
import { configure, getConsoleSink, getStreamSink } from "@logtape/logtape";
import { getLoggerConfig } from "@project/core";
import { Builtins, Cli } from "clipanion";

import { CLI_CONFIG } from "./config";

// Detect JSON agent mode before logging is configured.
const isJsonMode = process.argv.includes("--json");

await configure({
  ...getLoggerConfig(process.env),
  sinks: {
    console: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
  },
});

const cli = new Cli({
  binaryLabel: CLI_CONFIG.binaryLabel,
  binaryName: CLI_CONFIG.binaryName,
  binaryVersion: CLI_CONFIG.binaryVersion,
});

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

// Register your commands here:
// cli.register(MyCommand);

cli.runExit(process.argv.slice(2));
`,

    // apps/server/src/index.ts — remove skill routes
    'apps/server/src/index.ts': `// @project/server — entry point

import { Writable } from "node:stream";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { configure, getStreamSink } from "@logtape/logtape";
import type { Database, DbAdapterConfig } from "@project/core";
import { createDbAdapter, getLoggerConfig } from "@project/core";
import { SERVER_CONFIG } from "./config";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";

type D1Binding = Extract<DbAdapterConfig, { driver: "d1" }>["binding"];

interface ServerEnv {
  API_KEY?: string;
  DB?: D1Binding;
}

interface ServerVariables {
  db: Database;
}

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
  ...getLoggerConfig(process.env),
  sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
});

export function createApp(localDb: Database) {
  const app = new OpenAPIHono<{ Bindings: ServerEnv; Variables: ServerVariables }>();

  app.use("*", async (c, next) => {
    const binding = c.env && "DB" in c.env ? c.env.DB : undefined;

    if (binding) {
      const adapter = await createDbAdapter({ driver: "d1", binding });
      c.set("db", adapter.getDb());
    } else {
      c.set("db", localDb);
    }
    await next();
  });

  // Global middleware
  app.onError(errorHandler());
  app.use(\`\${SERVER_CONFIG.apiPrefix}/*\`, authMiddleware());

  // Mount routes here:
  // app.route(SERVER_CONFIG.apiPrefix, myRoutes);

  // OpenAPI documentation
  app.doc(SERVER_CONFIG.docPath, {
    openapi: "3.0.0",
    info: { title: "TypeScript Bun Starter API", version: "0.1.0" },
  });
  app.get(SERVER_CONFIG.swaggerPath, swaggerUI({ url: SERVER_CONFIG.docPath }));

  // Health check
  app.get("/", (c) => c.json({ status: "ok" }));

  return app;
}

// Construct the Bun local adapter explicitly so the server owns its runtime choice.
const localAdapter = await createDbAdapter({
  driver: "bun-sqlite",
  url: process.env.DATABASE_URL,
});

const app = createApp(localAdapter.getDb());

// Export AppType for typed RPC client reuse (hono/client)
export type AppType = typeof app;

export default {
  port: Number.isFinite(Number(process.env.PORT))
    ? Number(process.env.PORT)
    : SERVER_CONFIG.defaultPort,
  fetch: app.fetch,
};
`,

    // packages/core/tests/test-db.ts — remove skills table DDL
    'packages/core/tests/test-db.ts': `import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";

// Add your CREATE TABLE statements here after defining your schema.

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
`,

    // apps/cli/tests/test-setup.ts — remove skills table DDL
    'apps/cli/tests/test-setup.ts': `import { getDb } from "@project/core";

// Add your CREATE TABLE statements here after defining your schema.

// Force in-memory DB before lazy singleton is initialized
process.env.DATABASE_URL = ":memory:";

/**
 * Initialize the default in-memory DB with schema and clean state.
 * Must be called in beforeAll() of each CLI test file.
 */
export function setupCliTestDb() {
  const db = getDb();
  // Create tables and clean state here after defining your schema.
  return db;
}
`,

    // apps/server/tests/index.test.ts — remove skill route test
    'apps/server/tests/index.test.ts': `import { afterEach, describe, expect, test } from "bun:test";
import { createTestDb } from "@project/core/tests/test-db";
import { createApp } from "../src/index";

const cleanupFns: Array<() => void> = [];

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.();
  }
});

function makeApp() {
  const { sqlite, db } = createTestDb();
  cleanupFns.push(() => sqlite.close());
  return createApp(db);
}

describe("server entry", () => {
  test("GET / returns health status", async () => {
    const app = makeApp();
    const res = await app.request("/");

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("GET /doc returns OpenAPI JSON", async () => {
    const app = makeApp();
    const res = await app.request("/doc");

    expect(res.status).toBe(200);

    const body = (await res.json()) as { openapi: string; info: { title: string } };
    expect(body.openapi).toBe("3.0.0");
    expect(body.info.title).toBe("TypeScript Bun Starter API");
  });

  test("GET /swagger returns Swagger UI HTML", async () => {
    const app = makeApp();
    const res = await app.request("/swagger");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("swagger");
  });

  test("uses request D1 binding when available", async () => {
    const app = makeApp();
    const binding = {} as D1Database;

    const res = await app.request("/", undefined, { DB: binding });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
`,

    // packages/core/tests/config.test.ts — remove skill constraint test
    'packages/core/tests/config.test.ts': `import { describe, expect, test } from "bun:test";
import { CORE_CONFIG } from "../src/config";

describe("CORE_CONFIG", () => {
  test("has expected db defaults", () => {
    expect(CORE_CONFIG.defaultDbPath).toBe("data/app.db");
  });

  test("has all SQLite pragmas", () => {
    const { pragmas } = CORE_CONFIG;
    expect(pragmas.journalMode).toContain("WAL");
    expect(pragmas.synchronous).toContain("NORMAL");
    expect(pragmas.foreignKeys).toContain("foreign_keys");
  });
});
`,

    // packages/core/tests/db/adapters/bun-sqlite.test.ts — remove skills table test
    'packages/core/tests/db/adapters/bun-sqlite.test.ts': `import { describe, expect, test } from "bun:test";
import { BunSqliteAdapter } from "../../../src/db/adapters/bun-sqlite";

function extractRawSqlite(adapter: BunSqliteAdapter) {
  const db = adapter.getDb();
  const session = Reflect.get(db, "session");
  return Reflect.get(session, "client");
}

describe("BunSqliteAdapter", () => {
  test("creates in-memory database", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const db = adapter.getDb();
    expect(db).toBeDefined();
    adapter.close();
  });

  test("getDb returns a drizzle instance", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const db = adapter.getDb();
    expect(db).toBeDefined();
    expect(typeof db.select).toBe("function");
    adapter.close();
  });

  test("sets WAL pragma on file-based db", () => {
    const tmpPath = \`\${import.meta.dir}/.tmp-wal-test-\${Date.now()}.db\`;
    const adapter = new BunSqliteAdapter(tmpPath);
    try {
      const raw = extractRawSqlite(adapter);
      const result = raw.query("PRAGMA journal_mode").get() as Record<string, string>;
      expect(result.journal_mode).toBe("wal");
    } finally {
      adapter.close();
      // Clean up temp files
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          require("node:fs").unlinkSync(\`\${tmpPath}\${suffix}\`);
        } catch {}
      }
    }
  });

  test("sets foreign_keys pragma", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    const raw = extractRawSqlite(adapter);
    const result = raw.query("PRAGMA foreign_keys").get() as Record<string, number>;
    expect(result.foreign_keys).toBe(1);
    adapter.close();
  });

  test("close does not throw on in-memory db", () => {
    const adapter = new BunSqliteAdapter(":memory:");
    expect(() => adapter.close()).not.toThrow();
  });
});
`,
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
let removed = 0;
let rewritten = 0;

for (const rel of DELETE_FILES) {
    const abs = resolve(ROOT, rel);
    if (existsSync(abs)) {
        rmSync(abs);
        console.log(`  deleted  ${rel}`);
        removed++;
    } else {
        console.log(`  skip     ${rel} (not found)`);
    }
}

for (const [rel, content] of Object.entries(REWRITES)) {
    const abs = resolve(ROOT, rel);
    writeFileSync(abs, content);
    console.log(`  rewrote  ${rel}`);
    rewritten++;
}

console.log(`\nDone. Removed ${removed} files, rewrote ${rewritten} files.`);
console.log('Run `bun run check` to verify everything is clean.');
