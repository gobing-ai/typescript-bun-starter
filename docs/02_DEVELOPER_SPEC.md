# Developer Specification: TypeScript Bun Starter

> Implementation guide, conventions, and patterns for building agent skills on this starter.

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Bun | >= 1.1.0 | Runtime, package manager, test runner, bundler |
| TypeScript | >= 5.7.0 | Language (managed via devDependencies) |
| Biome | >= 2.0.0 | Lint + format (managed via devDependencies) |

No other global installations required. Bun replaces npm/yarn/pnpm, Node.js, and Jest.

## 2. Project Initialization

### 2.1 From Scratch (CLI-only Tier)

```bash
# Clone the starter
git clone <starter-repo-url> my-skill && cd my-skill

# Install all workspace dependencies
bun install

# Verify the setup
bun run check
```

### 2.2 Enabling API Tier

The `apps/server/` workspace is included but can be excluded from builds/tests if unused. To activate:

1. Ensure `apps/server/package.json` has the correct dependencies.
2. Create your first route in `apps/server/src/routes/`.
3. Run `bun run dev:server` to start the dev server with hot reload.

### 2.3 Enabling Web Tier

1. Add JSX config to `apps/server/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "hono/jsx"
     }
   }
   ```
2. Create view components in `apps/server/src/views/*.tsx`.
3. Register page routes in the server entry point.

## 3. Development Workflow

### 3.1 Daily Commands

```bash
# Run the CLI in dev mode
bun run dev:cli -- skill list --json

# Start API server with hot reload
bun run dev:server

# Run all checks (pre-commit gate)
bun run check

# Run tests with coverage
bun run test

# Format code
bun run format

# Lint with auto-fix
bun run lint-fix

# Type check only
bun run typecheck

# Database operations
bun run db:push          # Push schema changes (dev)
bun run db:generate      # Generate migration files (prod)
bun run db:migrate       # Apply migrations (prod)
```

### 3.2 Adding a New Skill

A "skill" is a business capability exposed through CLI, API, or both. Follow this sequence:

#### Step 1: Define the Database Schema

```typescript
// packages/core/src/db/schema.ts
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["pending", "running", "done", "failed"],
  }).notNull().default("pending"),
  input: text("input", { mode: "json" }),
  output: text("output", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

#### Step 2: Write Zod Schemas

Hand-write Zod schemas using `z` from `@hono/zod-openapi` with `.openapi()` metadata for OpenAPI spec generation. Do NOT use `drizzle-zod` or `drizzle-orm/zod` -- see ADR-004.

```typescript
// packages/core/src/schemas/task.ts
import { z } from "@hono/zod-openapi";

export const taskSelectSchema = z
  .object({
    id: z.string().openapi({ example: "abc-123" }),
    title: z.string().openapi({ example: "Process dataset" }),
    status: z.string().openapi({ example: "pending" }),
    input: z.unknown().nullable().openapi({ example: { query: "test" } }),
    output: z.unknown().nullable().openapi({ example: null }),
    createdAt: z.date().openapi({ example: "2026-04-10T00:00:00.000Z" }),
  })
  .openapi("Task");

export const taskInsertSchema = z
  .object({
    title: z.string().min(1).max(200).openapi({ example: "Process dataset" }),
    input: z.unknown().optional(),
  })
  .openapi("NewTask");

export type Task = z.infer<typeof taskSelectSchema>;
export type NewTask = z.infer<typeof taskInsertSchema>;
```

#### Step 3: Implement the Service

Services accept a `Database` instance via constructor injection. Import the type from `adapter.ts` and the default instance from `client.ts`. All methods must be async (no sync `.all()` or `.get()` calls) for D1 compatibility.

```typescript
// packages/core/src/services/task-service.ts
import { eq } from "drizzle-orm";
import type { Database } from "../db/adapter";
import { getDb } from "../db/client";
import { tasks } from "../db/schema";
import { logger } from "../logger";
import type { Result } from "../types/result";
import type { Task, NewTask } from "../schemas/task";

export class TaskService {
  constructor(private db: Database = getDb()) {}

  async create(input: NewTask): Promise<Result<Task>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const rows = await this.db
        .insert(tasks)
        .values({ ...input, id, createdAt: now })
        .returning();
      const row = rows[0];
      if (!row) {
        return { ok: false, error: new Error("Failed to create task") };
      }
      logger.info("Task created: {id}", { id });
      return { ok: true, data: row };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async list(): Promise<Result<Task[]>> {
    try {
      const rows = await this.db.select().from(tasks);
      return { ok: true, data: rows };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async getById(id: string): Promise<Result<Task>> {
    try {
      const rows = await this.db.select().from(tasks).where(eq(tasks.id, id));
      const row = rows[0];
      if (!row) {
        return { ok: false, error: new Error(`Task not found: ${id}`) };
      }
      return { ok: true, data: row };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
}
```

**Key patterns**:
- Use `.returning()` and access `rows[0]` instead of `.get()` for D1 compatibility.
- Always wrap in try/catch and return `Result<T>`.
- Import `Database` type from `"../db/adapter"` and default `db` from `"../db/client"`.

#### Step 4: Export from Core

```typescript
// packages/core/src/index.ts
export { TaskService } from "./services/task-service";
export { taskSelectSchema, taskInsertSchema } from "./schemas/task";
export type { Task, NewTask } from "./schemas/task";
```

#### Step 5: Add CLI Command

```typescript
// apps/cli/src/commands/task-create.ts
import { Command, Option } from "clipanion";
import { TaskService } from "@starter/core";

export class TaskCreateCommand extends Command {
  // Explicit constructor required for V8 function coverage reporting
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["task", "create"]];

  json = Option.Boolean("--json", false, {
    description: "Output as JSON (agent mode)",
  });

  title = Option.String("--title,-t", {
    description: "Task title",
    required: false,
  });

  async execute() {
    if (!this.title) {
      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ error: "--title is required" })}\n`,
        );
      } else {
        this.context.stderr.write("Error: --title is required\n");
      }
      return 1;
    }

    const service = new TaskService();
    const result = await service.create({ title: this.title });

    if (!result.ok) {
      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ error: result.error.message })}\n`,
        );
      } else {
        this.context.stderr.write(`Error: ${result.error.message}\n`);
      }
      return 1;
    }

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(result.data)}\n`);
    } else {
      this.context.stdout.write(`Created task: ${result.data.id}\n`);
    }
    return 0;
  }
}
```

**Important CLI patterns**:
- **Explicit constructor**: V8 function coverage does not count implicit class constructors. Add an explicit `constructor() { super(); }` with a biome-ignore comment.
- **Dual-mode output**: `--json` writes JSON to stdout, human mode writes to stdout/stderr.
- **Exit codes**: Return `0` for success, `1` for errors.
- **No `as any`**: Use Clipanion's native `cli.process()` with `Writable` streams for testing. Never cast context objects with `as any`.

#### Step 6: Add API Route (Tier 2+)

```typescript
// apps/server/src/routes/tasks.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TaskService, taskSelectSchema, taskInsertSchema } from "@starter/core";

const app = new OpenAPIHono();
const service = new TaskService();

const ErrorSchema = z.object({ error: z.string() });

// GET /tasks
const listRoute = createRoute({
  method: "get",
  path: "/tasks",
  tags: ["Tasks"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(taskSelectSchema) }),
        },
      },
      description: "List all tasks",
    },
  },
});

app.openapi(listRoute, async (c) => {
  const result = await service.list();
  if (!result.ok) return c.json({ error: result.error.message }, 500);
  return c.json({ data: result.data }, 200);
});

// POST /tasks
const createTaskRoute = createRoute({
  method: "post",
  path: "/tasks",
  tags: ["Tasks"],
  request: {
    body: {
      content: { "application/json": { schema: taskInsertSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ data: taskSelectSchema }),
        },
      },
      description: "Task created",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Validation error",
    },
  },
});

app.openapi(createTaskRoute, async (c) => {
  const body = c.req.valid("json");
  const result = await service.create(body);
  if (!result.ok) return c.json({ error: result.error.message }, 400);
  return c.json({ data: result.data }, 201);
});

export default app;
```

**Note**: Do not add explicit return type annotations to route handlers. Let TypeScript infer the return type from `c.json()`. Explicit `Promise<Response>` annotations cause type mismatches with Hono's overloaded signatures.

#### Step 7: Register Everything

```typescript
// apps/cli/src/index.ts -- add to command registry
cli.register(TaskCreateCommand);

// apps/server/src/index.ts -- mount route
app.route("/api", taskRoutes);
```

## 4. Code Conventions

### 4.1 TypeScript

| Rule | Detail |
|------|--------|
| Strict mode | `"strict": true` in tsconfig |
| No `any` | Never use `any` or `as any`. Use `unknown` + type narrowing, `Reflect.get()`, or `as unknown as TargetType` double cast |
| No biome-ignore for noExplicitAny | Fix the code instead of suppressing the lint rule |
| Interfaces for objects | `interface Foo { ... }` |
| Types for unions | `type Status = "pending" \| "done"` |
| Barrel exports | Each package has `src/index.ts` exporting the public API |
| Path aliases | `@starter/contracts` and `@starter/core` resolve via workspace protocol |

**Alternatives to `as any`**:

| Situation | Instead of `as any` | Use |
|-----------|---------------------|-----|
| Accessing internal APIs | `(x as any).prop` | `Reflect.get(x, "prop")` |
| Mock objects for third-party types | `mock as any` | `mock as unknown as TargetType` |
| Hono handler return types | `Promise<any>` | Remove explicit annotation, let TS infer from `c.json()` |
| Test utilities overriding context | `context = { ... } as any` | Use Clipanion's native context parameter |

### 4.2 File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Source files | kebab-case | `task-service.ts` |
| Test files | `tests/` at package root | `tests/services/task-service.test.ts` |
| Commands | Match the CLI path | `task-create.ts` for `task create` |
| Routes | Match the resource | `tasks.ts` for `/api/tasks` |
| Views (JSX) | Match the page | `dashboard.tsx` |

### 4.3 Code Style

Enforced by Biome. Key settings:

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### 4.4 Logging

- **Never** use `console.log/warn/error` in library or application code.
- Use `logger` from `@starter/core` (backed by LogTape).
- Use structured logging with named placeholders:

```typescript
// Good
logger.info("Task {id} completed in {ms}ms", { id, ms: elapsed });

// Bad -- never do this
// console.log(`Task ${id} completed`);
```

### 4.5 Error Handling

- Services return `Result<T, E>` -- never throw from service methods.
- Entry points (CLI `execute()`, API route handlers) are the only places that map errors to exit codes or HTTP status codes.
- Unexpected/system errors: catch at boundary, log with `logger.error`, return generic error to consumer.

```typescript
// Service layer
async delete(id: string): Promise<Result<void>> {
  try {
    const rows = await this.db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (rows.length === 0) {
      return { ok: false, error: new Error(`Not found: ${id}`) };
    }
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// CLI boundary
const result = await service.delete(id);
if (!result.ok) {
  this.context.stderr.write(`Error: ${result.error.message}\n`);
  return 1;
}

// API boundary
const result = await service.delete(id);
if (!result.ok) {
  return c.json({ error: result.error.message }, 404);
}
```

## 5. Testing

### 5.1 Test Runner

Bun's built-in test runner. No Jest, Vitest, or other test frameworks.

```bash
bun test                    # Run all tests
bun test --coverage         # With coverage report
bun test --watch            # Watch mode
bun test packages/core      # Test specific workspace
```

### 5.2 Test Directory Convention

Tests are in `tests/` at the **package root**, NOT `__tests__/` inside `src/`. This keeps `src/` clean and mirrors the source structure without interleaving.

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
```

Import paths from tests to source use relative paths (e.g., `../../src/services/skill-service`).

### 5.3 Test Patterns

#### Core Service Tests (Unit)

```typescript
// packages/core/tests/services/task-service.test.ts
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../src/db/schema";
import type { Database as AppDatabase } from "../../src/db/adapter";
import { TaskService } from "../../src/services/task-service";

function createTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  const db = drizzle({ client: sqlite, schema });
  sqlite.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT,
      output TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  return db;
}

describe("TaskService", () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(createTestDb());
  });

  test("create returns ok result", async () => {
    const result = await service.create({ title: "Test task" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Test task");
    }
  });

  test("getById returns error for missing task", async () => {
    const result = await service.getById("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("not found");
    }
  });
});
```

#### CLI Command Tests

Use Clipanion's `cli.process()` with Node.js `Writable` streams:

```typescript
// apps/cli/tests/commands/task-create.test.ts
import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Cli } from "clipanion";
import { TaskCreateCommand } from "../../src/commands/task-create";

function createMockWritable(collector: string[]) {
  return new Writable({
    write(chunk, _encoding, callback) {
      collector.push(chunk.toString());
      callback();
    },
  });
}

describe("task create", () => {
  test("--json with --title outputs JSON", async () => {
    const cli = new Cli({ binaryName: "tbs" });
    cli.register(TaskCreateCommand);

    const chunks: string[] = [];
    const command = cli.process(["task", "create", "--title", "Test", "--json"], {
      stdout: createMockWritable(chunks),
    }) as TaskCreateCommand;

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(chunks.join(""));
    expect(parsed.title).toBe("Test");
  });

  test("--json without --title returns error JSON", async () => {
    const cli = new Cli({ binaryName: "tbs" });
    cli.register(TaskCreateCommand);

    const chunks: string[] = [];
    const command = cli.process(["task", "create", "--json"], {
      stdout: createMockWritable(chunks),
    }) as TaskCreateCommand;

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const parsed = JSON.parse(chunks.join(""));
    expect(parsed.error).toBeDefined();
  });
});
```

#### API Route Tests

```typescript
// apps/server/tests/routes/tasks.test.ts
import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import taskRoutes from "../../src/routes/tasks";

function makeApp() {
  const app = new OpenAPIHono();
  app.route("/api", taskRoutes);
  return app;
}

describe("GET /tasks", () => {
  test("returns 200 with data array", async () => {
    const app = makeApp();
    const res = await app.request("/api/tasks");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("POST /tasks", () => {
  test("returns 201 on valid input", async () => {
    const app = makeApp();
    const res = await app.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New task" }),
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { data: { title: string } };
    expect(body.data.title).toBe("New task");
  });

  test("returns 400 on invalid input", async () => {
    const app = makeApp();
    const res = await app.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
```

### 5.4 Test Database Strategy

- **Unit tests**: Use `:memory:` SQLite database via constructor injection. Create schema inline.
- **Integration tests**: Use the default database file, cleared in `beforeAll`.
- **Never** test against the production database.

### 5.5 Coverage Targets

Per-file line coverage >= 90%, enforced by `scripts/check-coverage.ts`.

```bash
bun run test   # Runs coverage + coverage gate
bun run check  # lint + typecheck + coverage
```

**V8 function coverage quirk**: Bun uses V8's function coverage which does NOT count implicit class constructors. Add an explicit constructor to CLI command classes:

```typescript
// biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
constructor() {
  super();
}
```

## 6. Database Management

### 6.1 Adapter Architecture

The database layer uses an adapter pattern. Both `bun:sqlite` and Cloudflare D1 share the same Drizzle schema (`drizzle-orm/sqlite-core`). Only the driver initialization differs:

```
packages/core/src/db/
+-- schema.ts              # Table definitions (shared, driver-agnostic)
+-- adapter.ts             # DbAdapter interface + async factory + Database type
+-- client.ts              # Default client export (bun:sqlite convenience)
+-- adapters/
    +-- bun-sqlite.ts      # Local SQLite adapter (default)
    +-- d1.ts              # Cloudflare D1 adapter (Workers deployment)
```

**When to use which adapter**:

| Adapter | Use Case |
|---------|----------|
| `bun-sqlite` | Local development, CLI tools, compiled binaries, self-hosted API |
| `d1` | Cloudflare Workers deployment, edge API |

### 6.2 Schema Changes (Development)

```bash
# 1. Edit packages/core/src/db/schema.ts
# 2. Push changes directly to the dev database:
bun run db:push
```

**Note**: `drizzle-kit push` requires `better-sqlite3` as a devDependency. It's already listed in the root `package.json`.

### 6.3 Schema Changes (Production -- bun:sqlite)

```bash
# Generate migration SQL files:
bun run db:generate

# Review generated files in drizzle/ directory
# Then apply:
bun run db:migrate
```

### 6.4 Schema Changes (Production -- Cloudflare D1)

```bash
# Generate migration SQL files (same schema, same drizzle/ output):
bun run db:generate

# Apply to D1 via Wrangler:
wrangler d1 migrations apply <DATABASE_NAME> --remote
```

For local D1 development:

```bash
wrangler d1 migrations apply <DATABASE_NAME> --local
wrangler dev --local    # Runs API with local D1 emulator
```

### 6.5 Drizzle Kit Configuration

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/core/src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "data/app.db",
  },
} satisfies Config;
```

Note: The same `drizzle.config.ts` generates migrations for both adapters since they share `drizzle-orm/sqlite-core` schema definitions. D1 applies these same migrations via Wrangler.

### 6.6 bun:sqlite Pragmas

Set in `packages/core/src/db/adapters/bun-sqlite.ts` at connection time via `sqlite.run()`:

| Pragma | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | WAL | Concurrent reads while writing (essential for API) |
| `synchronous` | NORMAL | Balance safety vs performance |
| `foreign_keys` | ON | Enforce referential integrity |

D1 manages these automatically -- no pragma configuration needed.

### 6.7 Service Database Injection

Services accept a `Database` instance via constructor. Import the type from `adapter.ts` and the default from `client.ts`:

```typescript
import type { Database } from "../db/adapter";
import { getDb } from "../db/client";
```

This enables three scenarios:

```typescript
// 1. Default (bun:sqlite, local dev)
const service = new TaskService();

// 2. D1 (Cloudflare Workers)
import { createDbAdapter } from "../db/adapter";
const d1Db = (await createDbAdapter({ driver: "d1", binding: env.DB })).getDb();
const service = new TaskService(d1Db);

// 3. Tests (in-memory SQLite)
import { BunSqliteAdapter } from "../db/adapters/bun-sqlite";
const testAdapter = new BunSqliteAdapter(":memory:");
const service = new TaskService(testAdapter.getDb());
```

## 7. Scaffold Commands

The CLI provides commands for project initialization and feature management.

### 7.1 Available Commands

| Command | Description |
|---------|-------------|
| `tbs scaffold init` | Initialize or update project identity |
| `tbs scaffold add <feature>` | Install an optional feature |
| `tbs scaffold remove <feature>` | Uninstall an optional feature |
| `tbs scaffold list` | Show all features with installation status |
| `tbs scaffold validate` | Validate project contract integrity |

### 7.2 Project Identity

```bash
# Initialize (first time or reconfigure)
tbs scaffold init --name my-project --scope @myorg

# Preview changes without applying
tbs scaffold init --name my-project --scope @myorg --dry-run --json

# Customize binary name and branding
tbs scaffold init --name my-project --scope @myorg --bin mp --brand "My Project"

# Skip post-init verification
tbs scaffold init --name my-project --scope @myorg --skip-check
```

### 7.3 Feature Management

```bash
# List all features (required + optional) with status
tbs scaffold list

# Add optional features
tbs scaffold add cli        # Clipanion CLI tool
tbs scaffold add server    # Hono REST API server
tbs scaffold add webapp     # Astro web application

# Skills CRUD domain is built-in (always installed)

# Preview additions without applying
tbs scaffold add webapp --dry-run

# Remove optional features
tbs scaffold remove webapp

# Preview removals
tbs scaffold remove webapp --dry-run
```

### 7.4 Validation

```bash
# Validate project contracts (required workspaces, package.json integrity)
tbs scaffold validate

# Auto-fix fixable issues
tbs scaffold validate --fix

# JSON output for CI/agent consumption
tbs scaffold validate --json
```

### 7.5 Common Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying |
| `--json` | JSON output mode (for agents and CI) |
| `--help` | Show help for any command |

### 7.6 Feature Registry

| Feature | Type | Description |
|---------|------|-------------|
| `contracts` | Required | Shared transport-safe DTOs (always installed) |
| `core` | Required | Domain, data layer, shared utilities (always installed) |
| `cli` | Optional | Clipanion CLI with scaffold commands |
| `server` | Optional | Hono REST API with OpenAPI docs |
| `webapp` | Optional | Astro 5 web application |
| `skills` | Built-in | Full CRUD domain across all tiers (always installed) |

## 8. Building and Distribution

### 8.1 Compile CLI to Binary

```bash
# Default (current platform)
bun build --compile apps/cli/src/index.ts --outfile dist/ase

# Cross-compile
bun build --compile --target=bun-linux-x64 apps/cli/src/index.ts --outfile dist/ase-linux
bun build --compile --target=bun-darwin-arm64 apps/cli/src/index.ts --outfile dist/ase-macos
```

### 8.2 Docker (API/Web Tier)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile --production

COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/server apps/server

EXPOSE 3000
CMD ["bun", "run", "apps/server/src/index.ts"]
```

### 8.3 Size Budget

| Artifact | Target |
|----------|--------|
| Compiled CLI binary | < 90MB |
| Docker image (API) | < 150MB |
| `node_modules` | < 50MB |

## 9. API Design Conventions

### 8.1 Response Envelope

All API responses use a consistent envelope:

```typescript
// Success (single item)
{ "data": T }

// Success (list)
{ "data": T[] }

// Error
{ "error": string }
```

### 8.2 OpenAPI Documentation

Auto-generated from Zod schemas. Available at:

| Endpoint | Content |
|----------|---------|
| `GET /doc` | OpenAPI 3.0 JSON spec |
| `GET /swagger` | Swagger UI |

The OpenAPI spec at `/doc` is compatible with OpenAI Actions and Claude MCP tool definitions.

### 8.3 Versioning

API versioning via URL prefix when needed: `/api/v1/tasks`, `/api/v2/tasks`.

For the initial version, no prefix needed -- just `/api/tasks`.

## 10. Security Checklist

| Area | Requirement |
|------|-------------|
| API Auth | API key via `X-API-Key` header; auth skipped when `API_KEY` env not set. Timing-safe comparison prevents timing attacks |
| Secrets | Never commit `.env` files; use `.env.example` for templates |
| SQL Injection | Drizzle ORM parameterizes all queries by default |
| Input Validation | All inputs validated through Zod schemas before reaching services |
| CORS | Configure via Hono's `cors()` middleware for web tier |
| Rate Limiting | Optional middleware for public-facing deployments |

## 11. Git Conventions

### 10.1 Branch Strategy

```
main              # Production-ready
feat/task-crud    # Feature branches
fix/schema-typo   # Bug fixes
```

### 10.2 Commit Messages

Conventional commits format:

```
feat(core): add task service with CRUD operations
fix(cli): handle missing --title in agent mode
refactor(server): extract auth middleware
test(core): add task-service unit tests
docs: update architecture spec
```

### 10.3 Pre-Commit Gate

`bun run check` must pass before every commit. This runs:

1. `biome check .` -- lint + format validation
2. `tsc --noEmit` -- type checking
3. `bun test --coverage` -- full test suite with coverage

## 12. Dependency Management

### 11.1 Adding Dependencies

```bash
# Add to a specific workspace
bun add --cwd packages/core drizzle-orm
bun add --cwd apps/cli clipanion

# Add dev dependency to root
bun add -D @biomejs/biome
```

### 11.2 Dependency Placement

| Dependency | Location |
|-----------|----------|
| Business logic deps (drizzle-orm, zod) | `packages/core` |
| DB adapters (drizzle-orm/bun-sqlite, drizzle-orm/d1) | `packages/core` |
| CLI deps (clipanion) | `apps/cli` |
| Server deps (hono, @hono/swagger-ui) | `apps/server` |
| Tooling (biome, typescript, drizzle-kit, better-sqlite3, @types/bun) | Root `devDependencies` |

### 11.3 Version Pinning

Use exact versions for core dependencies. Use caret (`^`) for tooling.

## 13. IDE Setup

### 12.1 VS Code

Recommended extensions:
- Biome (`biomejs.biome`) -- replaces ESLint + Prettier extensions
- SQLite Viewer

Settings (`.vscode/settings.json`):

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### 12.2 TypeScript Configuration

Base `tsconfig.json` at root:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Each workspace extends the base:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```
