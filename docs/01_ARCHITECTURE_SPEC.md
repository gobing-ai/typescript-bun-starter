# Architecture Specification: TypeScript Bun Starter

> A schema-driven, JSON-first TypeScript/Bun monorepo starter for building AI agent skills with three deployment tiers.

## 1. Overview

### 1.1 Purpose

Provide a production-ready project starter that streamlines development of AI agent skills. Each skill shares a single source of truth for business logic, validation, and data persistence, exposed through up to three interfaces depending on the deployment tier.

### 1.2 Deployment Tiers

| Tier | Interfaces | Use Case |
|------|-----------|----------|
| **CLI-only** | CLI | Local agent tools, dev utilities, data pipelines |
| **CLI + API** | CLI, REST API | Remote agent tools, MCP-compatible services |
| **CLI + API + Web** | CLI, REST API, Web UI | Admin dashboards, agent skill playgrounds, monitoring |

### 1.3 Core Philosophy

- **Schema-driven**: Zod schemas with `.openapi()` metadata are the single source of truth -- they drive API validation, CLI arg types, and OpenAPI docs. Drizzle schemas handle persistence.
- **JSON-first**: Every CLI command supports `--json` for machine-consumable output. Every API returns JSON. Agents never need to parse human-readable text.
- **Ultra-low latency**: Bun runtime, bun:sqlite, no cold-start overhead. CLI under 50ms, API under 10ms p99.
- **Additive tiers**: Start with CLI-only, add API and Web layers without restructuring.

## 2. Technical Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Runtime | Bun | 1.x | Bundler, test runner, SQLite driver, HTTP server |
| Language | TypeScript | 5.x | Strict mode, no `any` |
| Database | bun:sqlite / Cloudflare D1 + Drizzle ORM | Latest | Schema-first persistence, adapter-based driver |
| Validation | Zod (`@hono/zod-openapi`) | 3.x | Schemas with `.openapi()` metadata for OpenAPI generation |
| CLI Framework | Clipanion | 4.0.0-rc.4 | Type-safe command pattern |
| API Framework | Hono | 4.x | Ultra-fast HTTP, OpenAPI integration |
| API Schema | @hono/zod-openapi | Latest | OpenAPI 3.0 auto-generation from Zod |
| Logging | LogTape | Latest | Structured logging, multiple sinks |
| Lint/Format | Biome | 2.x | Replaces ESLint + Prettier |
| Web UI (Tier 3) | Hono JSX | Built-in | Server-rendered pages, no SPA framework needed |

## 3. Monorepo Structure

### 3.1 Workspace Layout

```
<root>/
+-- package.json              # Workspace root + shared scripts
+-- tsconfig.json             # Base TS config (strict, paths)
+-- biome.json                # Shared lint/format rules
+-- drizzle.config.ts         # Drizzle Kit configuration
+-- bun.lock
|
+-- packages/
|   +-- core/                 # @starter/core -- business logic + data
|       +-- package.json
|       +-- tsconfig.json
|       +-- src/
|       |   +-- index.ts      # Public API barrel export
|       |   +-- db/
|       |   |   +-- schema.ts         # Drizzle table definitions (driver-agnostic)
|       |   |   +-- adapter.ts        # DbAdapter interface + async factory
|       |   |   +-- client.ts         # Default client export (bun:sqlite convenience)
|       |   |   +-- adapters/
|       |   |       +-- bun-sqlite.ts # Local SQLite adapter
|       |   |       +-- d1.ts         # Cloudflare D1 adapter
|       |   +-- schemas/
|       |   |   +-- skill.ts      # Plain Zod schemas with .openapi() metadata
|       |   +-- services/
|       |   |   +-- skill-service.ts  # Business logic services
|       |   +-- types/
|       |   |   +-- result.ts    # Result<T, E> discriminated union
|       |   +-- logger.ts        # LogTape logger instance
|       +-- tests/               # Unit tests (mirrors src/ structure)
|           +-- services/
|           |   +-- skill-service.test.ts
|           +-- db/
|               +-- adapter.test.ts
|               +-- adapters/
|                   +-- bun-sqlite.test.ts
|
+-- apps/
|   +-- cli/                  # @starter/cli -- command-line interface
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |   |   +-- index.ts      # CLI entry (Clipanion runner)
|   |   |   +-- commands/
|   |   |       +-- skill-create.ts
|   |   |       +-- skill-list.ts
|   |   |       +-- skill-get.ts
|   |   |       +-- skill-delete.ts
|   |   +-- tests/            # Unit tests
|   |       +-- commands/
|   |           +-- skill-create.test.ts
|   |           +-- skill-list.test.ts
|   |           +-- skill-get.test.ts
|   |           +-- skill-delete.test.ts
|   |
|   +-- server/               # @starter/server -- API + optional Web UI
|       +-- package.json
|       +-- tsconfig.json
|       +-- src/
|       |   +-- index.ts      # Hono server entry
|       |   +-- routes/
|       |   |   +-- skills.ts # OpenAPI route definitions
|       |   +-- middleware/
|       |       +-- auth.ts   # API key authentication
|       |       +-- error.ts  # Global error handler
|       +-- tests/            # Unit tests
|           +-- routes/
|           |   +-- skills.test.ts
|           +-- middleware/
|               +-- auth.test.ts
|               +-- error.test.ts
|
+-- docs/                     # Project documentation
```

### 3.2 Workspace Configuration

Root `package.json`:

```json
{
  "name": "typescript-bun-starter",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "check": "biome check . && bun run typecheck && bun run test:coverage",
    "test": "bun test --coverage --coverage-reporter=lcov --coverage-dir=coverage && bun run scripts/check-coverage.ts",
    "test:coverage": "bun test --coverage --reporter=dots",
    "format": "biome format --write .",
    "lint-fix": "biome lint --write .",
    "typecheck": "tsc --noEmit",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "dev:cli": "bun run apps/cli/src/index.ts",
    "dev:server": "bun --hot run apps/server/src/index.ts",
    "build:cli": "bun build --compile apps/cli/src/index.ts --outfile dist/tbs"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@types/bun": "^1.3.12",
    "better-sqlite3": "^12.8.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0"
  }
}
```

**Note**: `better-sqlite3` is required as a devDependency because `drizzle-kit push` uses it internally to connect to SQLite databases. `@types/bun` provides type declarations for Bun's built-in APIs.

### 3.3 Package Dependencies

```
@starter/cli ----depends-on----> @starter/core
@starter/server --depends-on----> @starter/core
@starter/core --depends-on----> bun:sqlite (built-in, local adapter)
                            ---> drizzle-orm/d1 (D1 adapter, optional)
```

Cross-package references use `workspace:*` protocol:

```json
{
  "name": "@starter/cli",
  "dependencies": {
    "@starter/core": "workspace:*"
  }
}
```

## 4. Data Architecture

### 4.1 Schema Architecture

The project maintains two complementary schema layers:

```
Drizzle Table Schema (drizzle-orm/sqlite-core)     Zod Schemas (@hono/zod-openapi)
        |                                                    |
        +---> Database persistence                   +---> API request/response validation
        +---> Migration generation                    +---> CLI argument validation
                                                      +---> OpenAPI spec generation
                                                      +---> TypeScript type inference
```

Zod schemas are **hand-written** (not derived from Drizzle) to allow precise control over validation rules (e.g., `z.string().min(1).max(100)`) and OpenAPI metadata (`.openapi()` extensions). Drizzle schemas handle database persistence and migration generation.

### 4.2 Database Adapter Architecture

#### 4.2.1 Design

The database layer uses an **adapter pattern** to abstract the underlying SQLite driver. Services receive a Drizzle database instance via dependency injection -- they never know (or care) which driver is active.

```
packages/core/src/db/
+-- schema.ts              # Table definitions (shared, driver-agnostic)
+-- adapter.ts             # DbAdapter interface + async factory
+-- adapters/
|   +-- bun-sqlite.ts      # bun:sqlite adapter (local dev, CLI, compiled binary)
|   +-- d1.ts              # Cloudflare D1 adapter (Workers, edge)
+-- client.ts              # Default client export (convenience)
```

**Dependency flow**:

```
Service Layer
     |
     v
DbAdapter interface  <--- BunSqliteAdapter (local)
                     <--- D1Adapter (Cloudflare Workers)
```

#### 4.2.2 Adapter Interface

```typescript
// packages/core/src/db/adapter.ts
/// <reference types="@cloudflare/workers-types" />
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./schema";

export type Database =
  | BunSQLiteDatabase<typeof schema>
  | DrizzleD1Database<typeof schema>;

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
```

**Key design decisions**:
- `createDbAdapter` is **async** and uses **dynamic `await import()`** to enable tree-shaking -- unused adapters are never loaded.
- `Database` is a union type covering both drivers. Services code against this union and remain driver-agnostic.
- The `d1.ts` file includes `/// <reference types="@cloudflare/workers-types" />` for the `D1Database` type.

#### 4.2.3 bun:sqlite Adapter

```typescript
// packages/core/src/db/adapters/bun-sqlite.ts
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
```

**Note**: Uses `sqlite.run()` for pragmas (not `sqlite.exec()`), consistent with Bun's `bun:sqlite` API.

#### 4.2.4 Cloudflare D1 Adapter

```typescript
// packages/core/src/db/adapters/d1.ts
/// <reference types="@cloudflare/workers-types" />
import { drizzle } from "drizzle-orm/d1";
import type { DbAdapter, Database } from "../adapter";
import * as schema from "../schema";

export class D1Adapter implements DbAdapter {
  private db: Database;

  constructor(binding: D1Database) {
    this.db = drizzle(binding, { schema });
  }

  getDb(): Database {
    return this.db;
  }

  close(): void {
    // D1 bindings are managed by the Workers runtime -- no-op
  }
}
```

#### 4.2.5 Default Client (Bun-Only Convenience)

For local development and CLI usage, a default `bun:sqlite` client is lazily initialised on first access. **This is a Bun-only convenience** — production server entry points should call `createDbAdapter()` with an explicit config instead.

```typescript
// packages/core/src/db/client.ts
import type { Database, DbAdapter } from "./adapter";

let _adapter: DbAdapter | undefined;

/**
 * Lazily initialise the default Bun SQLite adapter.
 * @internal — prefer explicit adapter construction via createDbAdapter().
 */
export function getDefaultAdapter(): DbAdapter {
  if (!_adapter) {
    const { BunSqliteAdapter } =
      require("./adapters/bun-sqlite") as typeof import("./adapters/bun-sqlite");
    _adapter = new BunSqliteAdapter();
  }
  return _adapter;
}

/** Get the default Database instance (Bun SQLite). */
export function getDb(): Database {
  return getDefaultAdapter().getDb();
}

/** Reset the singleton adapter. Used by tests. @internal */
export function _resetAdapter(): void {
  _adapter = undefined;
}
```

#### 4.2.6 Usage in Services (Dependency Injection)

Services accept a `Database` instance via constructor, defaulting to the convenience export. Imports are from `client.ts` (for the default instance) and `adapter.ts` (for the type):

```typescript
// packages/core/src/services/skill-service.ts
import type { Database } from "../db/adapter";
import { getDb } from "../db/client";

export class SkillService {
  constructor(private db: Database = getDb()) {}

  async list(): Promise<Result<Skill[]>> {
    const rows = await this.db.select().from(skills);
    return { ok: true, data: rows };
  }
}
```

All service methods are **async** to remain compatible with D1's async-only API. No synchronous `.all()` or `.get()` calls.

**Validation is enforced in the service layer** — inputs are parsed through Zod schemas with additional guards (e.g. whitespace-only rejection) before reaching the database. Failures return typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `InternalError`).

This enables:
- **CLI / local API**: `new SkillService()` — uses default `bun:sqlite`
- **Server (explicit)**: `new SkillService(adapter.getDb())` — server constructs its own adapter
- **Tests**: `new SkillService(testDb)` — uses in-memory SQLite

#### 4.2.7 Wiring in Cloudflare Workers

```typescript
// apps/server/src/index.ts (Workers entry)
import { OpenAPIHono } from "@hono/zod-openapi";
import { createDbAdapter } from "@starter/core";

interface Env {
  DB: D1Database;
  API_KEY: string;
}

const app = new OpenAPIHono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const adapter = await createDbAdapter({ driver: "d1", binding: c.env.DB });
  c.set("db", adapter.getDb());
  await next();
});
```

### 4.3 Schema Definition (Driver-Agnostic)

Schema uses `drizzle-orm/sqlite-core` which is shared across all SQLite-compatible drivers:

```typescript
// packages/core/src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  config: text("config", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### 4.4 Zod Schemas (Hand-Written with OpenAPI Metadata)

Schemas are hand-written using `z` from `@hono/zod-openapi`, with `.openapi()` metadata for spec generation:

```typescript
// packages/core/src/schemas/skill.ts
import { z } from "@hono/zod-openapi";

export const skillSelectSchema = z
  .object({
    id: z.string().openapi({ example: "abc-123" }),
    name: z.string().openapi({ example: "web-search" }),
    description: z.string().nullable().openapi({ example: "Search the web" }),
    version: z.number().openapi({ example: 1 }),
    config: z.unknown().nullable().openapi({ example: { timeout: 5000 } }),
    createdAt: z.date().openapi({ example: "2026-04-10T00:00:00.000Z" }),
    updatedAt: z.date().openapi({ example: "2026-04-10T00:00:00.000Z" }),
  })
  .openapi("Skill");

export const skillInsertSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: "web-search" }),
    description: z.string().optional().openapi({ example: "Search the web" }),
    config: z.unknown().optional().openapi({ example: { timeout: 5000 } }),
  })
  .openapi("NewSkill");

export type Skill = z.infer<typeof skillSelectSchema>;
export type NewSkill = z.infer<typeof skillInsertSchema>;
```

This approach provides full control over validation rules (e.g., `.min(1).max(100)`) and OpenAPI examples, which would be harder to customize with auto-derived schemas.

### 4.5 Migration Strategy

| Environment | Command | Adapter | Notes |
|-------------|---------|---------|-------|
| Local dev | `drizzle-kit push` | bun:sqlite | Fast iteration, no migration files |
| Local prod | `drizzle-kit generate` + `drizzle-kit migrate` | bun:sqlite | Versioned, auditable |
| Cloudflare D1 | `drizzle-kit generate` + `wrangler d1 migrations apply` | D1 | Uses Wrangler CLI to apply to D1 |

Both adapters share the same Drizzle schema, so generated migrations are compatible with both drivers.

**Note**: `drizzle-kit push` requires `better-sqlite3` as a devDependency to connect to the SQLite database.

### 4.6 Database Adapter Comparison

| Aspect | bun:sqlite | Cloudflare D1 |
|--------|-----------|---------------|
| **Driver import** | `drizzle-orm/bun-sqlite` | `drizzle-orm/d1` |
| **Initialization** | `new Database(path)` | Worker binding `env.DB` |
| **Sync API** | Available but not used | No (async only) |
| **WAL mode** | Yes (PRAGMA via `sqlite.run()`) | Managed by Cloudflare |
| **Connection lifecycle** | Explicit open/close | Managed by Workers runtime |
| **Local dev** | Native | `wrangler dev --local` (uses local D1 emulator) |
| **Migrations** | `drizzle-kit push/migrate` | `wrangler d1 migrations apply` |
| **Best for** | CLI tools, local API, compiled binaries | Edge deployment, global distribution |

### 4.7 Database Location

- **bun:sqlite**: Default `data/app.db` relative to project root. Override via `DATABASE_URL` env var. The `data/` directory is gitignored.
- **D1**: Configured via `wrangler.json` `d1_databases` binding. Database lives on Cloudflare's edge.

## 5. Interface Architecture

### 5.1 CLI Interface (Tier 1+)

**Framework**: Clipanion 4.0.0-rc.4 (command pattern).

**Dual-Mode Output**: Every command supports two output modes:

| Mode | Trigger | Output | Consumer |
|------|---------|--------|----------|
| Human | Default (no flag) | Plain text to stdout/stderr | Human developer |
| Agent | `--json` flag | Structured JSON to stdout | AI agents, scripts, pipes |

**Command Pattern**:

```typescript
// apps/cli/src/commands/skill-create.ts
import { Command, Option } from "clipanion";
import { SkillService } from "@starter/core";
import type { NewSkill } from "@starter/core";

export class SkillCreateCommand extends Command {
  // Explicit constructor required for V8 function coverage reporting
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["skill", "create"]];

  json = Option.Boolean("--json", false, {
    description: "Output as JSON (agent mode)",
  });

  name = Option.String("--name", {
    description: "Skill name (required)",
    required: false,
  });

  description = Option.String("--description", {
    description: "Skill description",
    required: false,
  });

  async execute() {
    if (!this.name) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: "--name is required" })}\n`);
      } else {
        this.context.stderr.write("Error: --name is required\n");
      }
      return 1;
    }

    const input: NewSkill = {
      name: this.name,
      ...(this.description ? { description: this.description } : {}),
    };

    const service = new SkillService();
    const result = await service.create(input);

    if (!result.ok) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: result.error.message })}\n`);
      } else {
        this.context.stderr.write(`Error: ${result.error.message}\n`);
      }
      return 1;
    }

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(result.data)}\n`);
    } else {
      this.context.stdout.write(`Created skill: ${result.data.name} (${result.data.id})\n`);
    }
    return 0;
  }
}
```

**CLI Entry Point**:

```typescript
// apps/cli/src/index.ts
#!/usr/bin/env bun
import { configure, getConsoleSink, getStreamSink } from "@logtape/logtape";
import { Writable } from "node:stream";
import { Cli } from "clipanion";

// Detect JSON agent mode — logs go to stderr in JSON mode to keep stdout clean
const isJsonMode = process.argv.includes("--json");

await configure({
  loggers: [
    { category: "tbs", lowestLevel: "info", sinks: ["console"] },
  ],
  sinks: {
    console: isJsonMode
      ? getStreamSink(Writable.toWeb(process.stderr))
      : getConsoleSink(),
  },
});

const cli = new Cli({
  binaryLabel: "TypeScript Bun Starter",
  binaryName: "tbs",
  binaryVersion: "0.1.0",
});

cli.register(SkillListCommand);
cli.register(SkillCreateCommand);
cli.register(SkillGetCommand);
cli.register(SkillDeleteCommand);

cli.runExit(process.argv.slice(2));
```

### 5.2 API Interface (Tier 2+)

**Framework**: Hono with `@hono/zod-openapi` for auto-generated OpenAPI specs.

**Route Pattern** (return types are inferred from `c.json()` -- no explicit `Promise<Response>` annotations):

```typescript
// apps/server/src/routes/skills.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Skill } from "@starter/core";
import { SkillService, skillInsertSchema, skillSelectSchema } from "@starter/core";

const app = new OpenAPIHono();
const service = new SkillService();

const ErrorSchema = z.object({ error: z.string() });

const listRoute = createRoute({
  method: "get",
  path: "/skills",
  tags: ["Skills"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(skillSelectSchema) }),
        },
      },
      description: "List all skills",
    },
  },
});

app.openapi(listRoute, async (c) => {
  const result = await service.list();
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json({ data: result.data }, 200);
});

export default app;
```

**Server Entry**:

```typescript
// apps/server/src/index.ts
import { Writable } from "node:stream";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { configure, getStreamSink } from "@logtape/logtape";
import { createDbAdapter } from "@starter/core";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { createSkillRoutes } from "./routes/skills";

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
  sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
  loggers: [
    { category: "tbs", lowestLevel: "info", sinks: ["console"] },
  ],
});

// Construct adapter explicitly — server owns its runtime choice
const adapter = await createDbAdapter({
  driver: "bun-sqlite",
  url: process.env.DATABASE_URL,
});

const app = new OpenAPIHono();
app.onError(errorHandler());
app.use("/api/*", authMiddleware());

// Inject the adapter's DB — no hidden Bun singleton
app.route("/api", createSkillRoutes(adapter.getDb()));

// ...OpenAPI docs, health check, export
```

**Auth Middleware** (plain function, not `createMiddleware`). Only supports `X-API-Key` header authentication:

```typescript
// apps/server/src/middleware/auth.ts
import type { MiddlewareHandler } from "hono";

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const expectedKey = process.env.API_KEY;

    // Dev mode: skip auth when API_KEY is not configured
    if (!expectedKey) {
      return next();
    }

    const providedKey = c.req.header("X-API-Key");

    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}
```

**Error Handler** (sanitizes internal error details from 5xx responses):

```typescript
// apps/server/src/middleware/error.ts
import { isAppError, logger } from "@starter/core";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function errorHandler() {
  return (err: Error, c: Context) => {
    const status = resolveStatus(err);
    // Sanitize: non-AppError 5xx errors get a generic message
    const safeMessage = status >= 500 && !isAppError(err) ? "Internal Server Error" : err.message;

    logger.error("Unhandled error: {message}", {
      message: err.message,
      stack: err.stack,
    });

    return c.json(
      { error: safeMessage || "Internal Server Error" },
      status as ContentfulStatusCode,
    );
  };
}

function resolveStatus(err: Error): number {
  if (isAppError(err)) {
    switch (err.code) {
      case "NOT_FOUND": return 404;
      case "VALIDATION": return 400;
      case "CONFLICT": return 409;
      case "INTERNAL": return 500;
    }
  }
  if ("status" in err && typeof err.status === "number") return err.status;
  return 500;
}
```

### 5.3 Web Interface (Tier 3)

**Approach**: Hono JSX -- server-rendered HTML pages served by the same Hono instance that serves the API. No SPA framework, no build step for frontend.

**Rationale**: Agent skill UIs are admin/monitoring dashboards, not full web applications. Hono's built-in JSX provides:
- Zero additional dependencies
- Same runtime as the API (no separate build/deploy)
- Server-rendered pages with instant load times
- HTMX-compatible for interactive updates without client-side JS frameworks

## 6. Cross-Cutting Concerns

### 6.1 Logging

**Library**: LogTape -- structured, sink-based, zero-config for libraries.

**Pattern**:

```typescript
// packages/core/src/logger.ts
import { getLogger } from "@logtape/logtape";

export const logger = getLogger(["tbs"]);
```

Configuration happens only in entry points (CLI `index.ts`, server `index.ts`). Both send logs to stderr so stdout stays clean for JSON output:

```typescript
// Server — always stderr
import { configure, getStreamSink } from "@logtape/logtape";
import { Writable } from "node:stream";

await configure({
  sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
  loggers: [
    { category: "tbs", lowestLevel: "info", sinks: ["console"] },
  ],
});

// CLI — stderr in --json mode, console otherwise
import { getConsoleSink, getStreamSink } from "@logtape/logtape";

const isJsonMode = process.argv.includes("--json");

await configure({
  sinks: {
    console: isJsonMode
      ? getStreamSink(Writable.toWeb(process.stderr))
      : getConsoleSink(),
  },
  loggers: [
    { category: "tbs", lowestLevel: "info", sinks: ["console"] },
  ],
});
```

### 6.2 Error Handling

**Strategy**: Typed result pattern — services return `Result<T, E>` with typed `AppError` subclasses instead of throwing.

```typescript
// packages/core/src/types/result.ts
import type { AppError } from "../errors";
export type Result<T, E = AppError | Error> = { ok: true; data: T } | { ok: false; error: E };
```

**Typed Error Model**:

```typescript
// packages/core/src/errors.ts
export type ErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) { super(message); this.code = code; }
}

export class NotFoundError extends AppError { /* 404 */ }
export class ValidationError extends AppError { /* 400 */ }
export class ConflictError extends AppError { /* 409 */ }
export class InternalError extends AppError { /* 500 */ }
```

- **CLI**: Renders error to stderr or JSON `{ "error": "..." }` to stdout in agent mode.
- **API**: Route handlers map `AppError.code` to HTTP status codes. Global error handler sanitizes non-AppError 5xx errors.
- **Unexpected errors**: Caught at boundary, logged internally, returned as generic "Internal Server Error" to clients.

### 6.3 Configuration

**Pattern**: Environment variables + `.env` files (Bun loads `.env` automatically).

```
DATABASE_URL=data/app.db
API_KEY=sk-local-dev-key
PORT=3000
LOG_LEVEL=info
```

### 6.4 Testing

**Runner**: Bun's built-in test runner (`bun test`).

**Test Directory Convention**: Tests are in `tests/` at the package root (NOT `__tests__/` inside `src/`). This keeps `src/` clean and mirrors the source structure.

```
packages/core/
  src/
    services/skill-service.ts
    db/adapter.ts
  tests/
    services/skill-service.test.ts
    db/adapter.test.ts
apps/cli/
  src/
    commands/skill-create.ts
  tests/
    commands/skill-create.test.ts
apps/server/
  src/
    routes/skills.ts
    middleware/auth.ts
  tests/
    routes/skills.test.ts
    middleware/auth.test.ts
```

**Patterns**:
- **Core services**: Unit tests with in-memory SQLite (`:memory:`) via constructor injection.
- **CLI commands**: Test `execute()` using Clipanion's native `cli.process()` with `Writable` streams for stdout/stderr.
- **API routes**: `app.request()` helper (Hono's built-in test utility).

### 6.5 Binary Compilation

For distribution as standalone CLI tools:

```bash
bun build --compile apps/cli/src/index.ts --outfile dist/tbs
```

Target: Under 90MB including Bun runtime. Cross-compilation supported via `--target` flag.

## 7. Tier Feature Matrix

| Feature | CLI-only | CLI + API | CLI + API + Web |
|---------|----------|-----------|-----------------|
| `packages/core` | Yes | Yes | Yes |
| `apps/cli` | Yes | Yes | Yes |
| `apps/server` (API routes) | No | Yes | Yes |
| `apps/server` (Web views) | No | No | Yes |
| bun:sqlite adapter | Yes | Yes | Yes |
| Cloudflare D1 adapter | Optional | Optional | Optional |
| Drizzle ORM (sqlite-core) | Yes | Yes | Yes |
| Zod schemas (with .openapi()) | Yes | Yes | Yes |
| Clipanion | Yes | Yes | Yes |
| Hono + zod-openapi | No | Yes | Yes |
| Swagger UI | No | Yes | Yes |
| Hono JSX + HTMX | No | No | Yes |
| `bun build --compile` | Yes | Optional | Optional |
| LogTape | Yes | Yes | Yes |
| Biome | Yes | Yes | Yes |

## 8. Architecture Decision Records

### ADR-001: Bun Workspaces over Turborepo/Nx

**Decision**: Use native Bun workspaces without an orchestration layer.

**Rationale**: Bun workspaces handle dependency resolution, hoisting, and `--filter` script execution natively. Turborepo/Nx add complexity and caching that's unnecessary for a 2-3 package monorepo. Bun's install speed (28x npm) eliminates the need for aggressive caching.

### ADR-002: Clipanion over Commander.js

**Decision**: Use Clipanion 4.0.0-rc.4 for CLI command framework.

**Rationale**: Clipanion provides a class-based command pattern that maps naturally to the "one skill = one command" model. Its `static paths` system enables hierarchical subcommands (`skill list`, `skill create`). Commander.js is simpler but lacks the structured command pattern.

### ADR-003: Hono JSX over React/Vue/Svelte for Web Tier

**Decision**: Use Hono's built-in JSX with HTMX for the web tier.

**Rationale**: Agent skill UIs are admin/monitoring dashboards, not full web applications. Hono JSX runs in the same process, requires no build step, and HTMX provides interactivity without a client-side framework. This eliminates an entire build pipeline and keeps the web tier as lightweight as the API tier.

### ADR-004: Hand-Written Zod Schemas over drizzle-zod

**Decision**: Use hand-written Zod schemas with `@hono/zod-openapi`'s `z` instance and `.openapi()` metadata, rather than auto-deriving from Drizzle schemas via `drizzle-zod` or `drizzle-orm/zod`.

**Rationale**: The standalone `drizzle-zod` package caused duplicate `zod` instance issues with `@hono/zod-openapi`. While Drizzle's built-in `createSchemaFactory` can inject Hono's Zod instance, hand-written schemas provide precise control over validation rules (e.g., `.min(1).max(100)`) and OpenAPI examples that are awkward to express via Drizzle's column-level schema overrides. The maintenance cost of keeping Zod and Drizzle schemas in sync is low for this project's scale.

### ADR-005: Database Adapter Pattern for Multi-Driver Support

**Decision**: Abstract the database driver behind a `DbAdapter` interface with concrete implementations for `bun:sqlite` and Cloudflare D1. Services receive a Drizzle `Database` instance via constructor injection.

**Rationale**: Both `bun:sqlite` and D1 use Drizzle's `sqlite-core` schema definitions -- the table definitions are 100% shared. Only the driver initialization differs (`new Database(path)` vs. Workers binding). The adapter pattern isolates this difference to a single async factory function while keeping services, schemas, and business logic completely driver-agnostic. This also makes testing trivial -- inject an in-memory SQLite instance. The `bun:sqlite` adapter is the default for local dev/CLI; D1 activates in Cloudflare Workers environments.

**Trade-off**: Services must use async-only query patterns (no synchronous `.all()` or `.get()` calls) to remain compatible with D1's async-only API. This is a minor constraint since most code is already async.

### ADR-006: Result Pattern over Exceptions

**Decision**: Core services return `Result<T, E>` instead of throwing exceptions.

**Rationale**: Explicit error handling prevents silent failures in agent pipelines. CLI and API boundaries map `Result.error` to appropriate exit codes / HTTP status codes. No try/catch boilerplate at every call site.

### ADR-007: LogTape over Pino/Winston

**Decision**: Use LogTape for structured logging.

**Rationale**: LogTape follows the "library never configures logging" principle -- only entry points configure sinks. This prevents conflicts when core is consumed by both CLI and API. It supports structured data, lazy evaluation, and multiple sinks (console, file, OpenTelemetry).

## 9. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| CLI cold start | < 50ms | `time bun run apps/cli/src/index.ts --help` |
| CLI command execution | < 100ms | Typical CRUD operation |
| API p99 latency | < 10ms | Local SQLite reads |
| Compiled binary size | < 90MB | `bun build --compile` output |
| Type coverage | 100% | No `any` types, `strict: true` |
| Test coverage | Per-file >= 90% | `bun test --coverage` + `scripts/check-coverage.ts` |
| `bun install` | < 2s | Full workspace install |

## 10. Reference

- [awesome-typesafe libraries](https://github.com/jellydn/awesome-typesafe)
