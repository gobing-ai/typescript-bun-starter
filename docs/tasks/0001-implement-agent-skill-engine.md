---
id: "0001"
title: "Implement TypeScript Bun Starter Project"
status: Done
priority: high
created: "2026-04-10"
ref:
  arch: docs/01_ARCHITECTURE_SPEC.md
  dev: docs/02_DEVELOPER_SPEC.md
  tdd: docs/tdd-for-framework.md
---

# Task: Implement TypeScript Bun Starter Project

Build the complete project starter from the architecture and developer specifications. This is a scaffold implementation with a working "skills" example domain to validate the full stack.

## References

All design decisions, patterns, and conventions are defined in:
- **Architecture**: `docs/01_ARCHITECTURE_SPEC.md` -- monorepo structure, data architecture, interface design, ADRs
- **Developer Guide**: `docs/02_DEVELOPER_SPEC.md` -- code conventions, testing patterns, DB management, build/distribution
- **Original TDD**: `docs/tdd-for-framework.md` -- initial tech stack decisions

## Scope

### In Scope
- Full monorepo workspace setup (packages/core, apps/cli, apps/server)
- Database adapter layer (bun:sqlite + D1)
- Example "skills" domain CRUD (schema, service, CLI command, API route)
- Testing infrastructure and example tests
- Tooling configuration (Biome, TypeScript, Drizzle Kit)
- Build scripts (check, test, format, lint, db operations, dev servers, compile)

### Out of Scope
- Web tier (Hono JSX views) -- deferred to a follow-up task
- CI/CD pipeline configuration
- Production deployment configs (Docker, Wrangler)
- Additional example domains beyond "skills"

## Implementation Phases

---

### Phase 1: Project Foundation

**Goal**: Bootable monorepo with tooling passing.

#### 1.1 Root configuration files

Create at project root:

| File | Details |
|------|---------|
| `package.json` | Workspace root with `"workspaces": ["packages/*", "apps/*"]`, all npm scripts from Dev Spec section 3.1, devDependencies: `@biomejs/biome`, `drizzle-kit`, `typescript` |
| `tsconfig.json` | Base TS config: `strict: true`, `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. See Dev Spec section 12.2 |
| `biome.json` | Formatter: 2-space indent, double quotes, semicolons, trailing commas, lineWidth 100. Linter: `recommended: true`, `noExplicitAny: "error"`. See Dev Spec section 4.3 |
| `drizzle.config.ts` | Schema path: `./packages/core/src/db/schema.ts`, out: `./drizzle`, dialect: `sqlite`, dbCredentials with `DATABASE_URL` fallback. See Dev Spec section 6.5 |
| `.env.example` | Template with `DATABASE_URL`, `API_KEY`, `PORT`, `LOG_LEVEL` |
| `.gitignore` | Add `data/`, `dist/`, `drizzle/`, `.env`, `.env.*` (keep `.env.example`) |

#### 1.2 Workspace package.json files

Each workspace needs a `package.json` with correct `name` and dependencies:

**`packages/core/package.json`**:
- name: `@project/core`
- dependencies: `drizzle-orm`, `zod`, `@hono/zod-openapi`, `@logtape/logtape`

**`apps/cli/package.json`**:
- name: `@project/cli`
- dependencies: `@project/core` (`workspace:*`), `clipanion`, `@clack/prompts`

**`apps/server/package.json`**:
- name: `@project/server`
- dependencies: `@project/core` (`workspace:*`), `hono`, `@hono/zod-openapi`, `@hono/swagger-ui`

Each workspace also needs a `tsconfig.json` extending the root. See Dev Spec section 12.2.

#### 1.3 Install and verify

```bash
bun install
bun run check   # Should pass (lint + typecheck + test) -- empty but no errors
```

**Completion gate**: `bun install` succeeds, `bun run check` exits cleanly.

---

### Phase 2: Core Package (packages/core)

**Goal**: Shared business logic, database layer, schemas, and services.

#### 2.1 Database adapter layer

Create the adapter architecture from Arch Spec section 4.2:

| File | Purpose |
|------|---------|
| `packages/core/src/db/schema.ts` | Drizzle table definitions using `drizzle-orm/sqlite-core`. Example `skills` table: id (text PK), name, description, version, config (json), createdAt, updatedAt. See Arch Spec section 4.3 |
| `packages/core/src/db/adapter.ts` | `DbAdapter` interface, `Database` union type, `DbAdapterConfig` discriminated union, `createDbAdapter()` factory. See Arch Spec section 4.2.2 |
| `packages/core/src/db/adapters/bun-sqlite.ts` | `BunSqliteAdapter` class. Opens `bun:sqlite`, sets WAL/NORMAL/foreign_keys pragmas, creates Drizzle instance. See Arch Spec section 4.2.3 |
| `packages/core/src/db/adapters/d1.ts` | `D1Adapter` class. Wraps `D1Database` binding with `drizzle-orm/d1`. Close is no-op. See Arch Spec section 4.2.4 |
| `packages/core/src/db/client.ts` | Convenience export: creates default `BunSqliteAdapter` and exports `db` + `defaultAdapter`. See Arch Spec section 4.2.5 |

**Key constraint**: All adapters must expose the same Drizzle API surface. Services use async-only patterns for D1 compatibility.

#### 2.2 Zod schemas

| File | Purpose |
|------|---------|
| `packages/core/src/schemas/skill.ts` | Use `createSchemaFactory({ zodInstance: z })` from `drizzle-orm/zod` with `@hono/zod-openapi`'s `z`. Export `skillSelectSchema`, `skillInsertSchema`, `skillUpdateSchema` with refinements. Export inferred types `Skill`, `NewSkill`. See Arch Spec section 4.4 |

#### 2.3 Shared types

| File | Purpose |
|------|---------|
| `packages/core/src/types/result.ts` | `Result<T, E = Error>` discriminated union type. See Arch Spec section 6.2 |
| `packages/core/src/types/index.ts` | Barrel export for all shared types |

#### 2.4 Logger

| File | Purpose |
|------|---------|
| `packages/core/src/logger.ts` | Export `logger` from `@logtape/logtape` via `getLogger(["tbs"])`. Libraries never configure -- only entry points do. See Arch Spec section 6.1 |

#### 2.5 Skill service

| File | Purpose |
|------|---------|
| `packages/core/src/services/skill-service.ts` | `SkillService` class with constructor injection (`db: Database = defaultDb`). Methods: `create(input)`, `list()`, `getById(id)`, `update(id, input)`, `delete(id)`. All return `Result<T>`. All queries async. See Dev Spec section 3.2 Step 3 |

#### 2.6 Barrel export

| File | Purpose |
|------|---------|
| `packages/core/src/index.ts` | Re-export everything public: adapter types/factory, schemas, services, logger, db client, result type |

**Completion gate**: `bun run typecheck` passes for `packages/core`. All exports resolve correctly from `@project/core`.

---

### Phase 3: CLI Application (apps/cli)

**Goal**: Working CLI with Clipanion commands and Clack interactive prompts.

#### 3.1 CLI entry point

| File | Purpose |
|------|---------|
| `apps/cli/src/index.ts` | Shebang `#!/usr/bin/env bun`. Configure LogTape sinks. Create `Cli` instance with `binaryLabel`, `binaryName: "tbs"`, `binaryVersion`. Register all commands. Call `cli.runExit()`. See Arch Spec section 5.1 |

#### 3.2 Skill commands

Each command implements dual-mode output: Clack UI (default) or JSON (`--json` flag).

| File | Command | Flags | Behavior |
|------|---------|-------|----------|
| `apps/cli/src/commands/skill-list.ts` | `skill list` | `--json` | List all skills. JSON: array to stdout. Human: Clack table/select |
| `apps/cli/src/commands/skill-create.ts` | `skill create` | `--json`, `--name`, `--description` | Create skill. Interactive prompts if flags omitted and not --json |
| `apps/cli/src/commands/skill-get.ts` | `skill get` | `--json`, `--id` | Get single skill by ID |
| `apps/cli/src/commands/skill-delete.ts` | `skill delete` | `--json`, `--id` | Delete skill by ID, with confirmation prompt in human mode |

Pattern for each command:
1. Extend `Command` from `clipanion`
2. Declare `static paths` for the command path
3. Declare `--json` as `Option.Boolean`
4. Declare domain-specific options
5. `async execute()`: call service, branch on `this.json`, write to `this.context.stdout`
6. Return exit code (0 = success, 1 = error)

See Arch Spec section 5.1 and Dev Spec section 3.2 Step 5 for full code patterns.

#### 3.3 Clack UI helpers (optional, for human-mode rendering)

| File | Purpose |
|------|---------|
| `apps/cli/src/ui/skill-table.ts` | Render skills as a Clack-styled table or select list |

**Completion gate**: `bun run dev:cli -- skill list --json` executes and outputs valid JSON. `bun run dev:cli -- skill create --name "test" --json` creates a skill and outputs it.

---

### Phase 4: API Server (apps/server)

**Goal**: Hono server with OpenAPI auto-generation and Swagger UI.

#### 4.1 Server entry point

| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Create `OpenAPIHono` app. Apply global middleware (error handler, auth for `/api/*`). Mount routes at `/api`. Configure `/doc` endpoint for OpenAPI JSON. Configure `/swagger` for Swagger UI. Export Bun-compatible server object `{ port, fetch }`. See Arch Spec section 5.2 |

#### 4.2 Middleware

| File | Purpose |
|------|---------|
| `apps/server/src/middleware/error.ts` | Global error handler middleware. Maps `Result.error` to HTTP status codes. Catches unexpected errors, logs, returns 500 |
| `apps/server/src/middleware/auth.ts` | API key middleware for `/api/*` routes. Checks `X-API-Key` header against `API_KEY` env var using timing-safe comparison. Returns 401 if invalid. Skipped when `API_KEY` env not set (dev mode). See Arch Spec section 5.2 |

#### 4.3 Skill routes

| File | Purpose |
|------|---------|
| `apps/server/src/routes/skills.ts` | OpenAPI route definitions using `createRoute()` from `@hono/zod-openapi`. Endpoints: GET /skills (list), GET /skills/:id (get), POST /skills (create), DELETE /skills/:id (delete). All use Zod schemas from core for request/response validation. See Dev Spec section 3.2 Step 6 |

Route pattern:
1. Define route with `createRoute()` specifying method, path, request schema, response schemas
2. Register with `app.openapi(route, handler)`
3. Handler calls `SkillService`, returns `c.json()` with envelope `{ data }` or `{ error }`

#### 4.4 Database wiring for different adapters

The server entry must support both local dev (bun:sqlite) and Workers deployment (D1):

- **Default (bun run dev:server)**: Uses `@project/core`'s default client export
- **Workers**: Receives `D1Database` binding from Hono context, creates adapter via `createDbAdapter()`

**Completion gate**: `bun run dev:server` starts, `GET /doc` returns valid OpenAPI JSON, `POST /api/skills` creates a skill, `GET /api/skills` lists skills.

---

### Phase 5: Testing

**Goal**: Test infrastructure and example tests at target coverage.

#### 5.1 Core service tests

| File | Tests |
|------|-------|
| `packages/core/src/services/__tests__/skill-service.test.ts` | CRUD operations against in-memory SQLite. Test create ok, create validation, list, getById found, getById not found, update, delete. Use `BunSqliteAdapter(":memory:")` for injection. See Dev Spec section 5.2 |

#### 5.2 CLI command tests

| File | Tests |
|------|-------|
| `apps/cli/src/commands/__tests__/skill-list.test.ts` | Test `--json` mode outputs valid JSON array. Test without `--json` (may require mocking Clack). See Dev Spec section 5.2 |
| `apps/cli/src/commands/__tests__/skill-create.test.ts` | Test `--json --name "X"` creates and returns JSON. Test `--json` without `--name` returns error JSON |

#### 5.3 API route tests

| File | Tests |
|------|-------|
| `apps/server/src/routes/__tests__/skills.test.ts` | Test GET /skills returns 200 with data array. Test POST /skills with valid body returns 201. Test POST with invalid body returns 400. Test GET /skills/:id returns 200 or 404. Use Hono's `app.request()` test helper. See Dev Spec section 5.2 |

#### 5.4 Database adapter tests

| File | Tests |
|------|-------|
| `packages/core/src/db/adapters/__tests__/bun-sqlite.test.ts` | Test adapter creates DB, returns Drizzle instance, sets WAL pragma, closes cleanly |

**Completion gate**: `bun run test --coverage` passes with > 90% coverage. `bun run check` passes clean.

---

### Phase 6: Build & Final Verification

**Goal**: All scripts work, binary compiles, project is production-ready.

#### 6.1 Verify all npm scripts

| Script | Expected Result |
|--------|----------------|
| `bun run check` | Biome check + tsc --noEmit + bun test all pass |
| `bun run test` | Full test suite with coverage report |
| `bun run format` | Biome formats all files |
| `bun run lint-fix` | Biome lint with auto-fix |
| `bun run typecheck` | TypeScript strict mode passes |
| `bun run db:push` | Pushes schema to local SQLite |
| `bun run db:generate` | Generates migration files in `drizzle/` |
| `bun run dev:cli` | Runs CLI interactively |
| `bun run dev:server` | Starts API server with hot reload |
| `bun run build:cli` | Compiles standalone binary to `dist/` |

#### 6.2 Binary compilation test

```bash
bun run build:cli
./dist/tbs skill list --json    # Should output JSON
ls -lh dist/tbs                 # Should be under 90MB
```

#### 6.3 Clean state verification

```bash
rm -rf node_modules bun.lock
bun install
bun run check                   # Full green field install + verify
```

**Completion gate**: All scripts succeed. Binary runs. Clean install works. Coverage > 90%.

---

## File Creation Checklist

### Root (6 files)
- [ ] `package.json` -- workspace root with scripts and devDeps
- [ ] `tsconfig.json` -- base TypeScript strict config
- [ ] `biome.json` -- lint + format rules
- [ ] `drizzle.config.ts` -- Drizzle Kit config
- [ ] `.env.example` -- environment variable template
- [ ] `.gitignore` -- update with data/, dist/, drizzle/, .env

### packages/core (12 files)
- [ ] `packages/core/package.json`
- [ ] `packages/core/tsconfig.json`
- [ ] `packages/core/src/index.ts`
- [ ] `packages/core/src/logger.ts`
- [ ] `packages/core/src/db/schema.ts`
- [ ] `packages/core/src/db/adapter.ts`
- [ ] `packages/core/src/db/client.ts`
- [ ] `packages/core/src/db/adapters/bun-sqlite.ts`
- [ ] `packages/core/src/db/adapters/d1.ts`
- [ ] `packages/core/src/schemas/skill.ts`
- [ ] `packages/core/src/services/skill-service.ts`
- [ ] `packages/core/src/types/result.ts`

### apps/cli (7 files)
- [ ] `apps/cli/package.json`
- [ ] `apps/cli/tsconfig.json`
- [ ] `apps/cli/src/index.ts`
- [ ] `apps/cli/src/commands/skill-list.ts`
- [ ] `apps/cli/src/commands/skill-create.ts`
- [ ] `apps/cli/src/commands/skill-get.ts`
- [ ] `apps/cli/src/commands/skill-delete.ts`

### apps/server (6 files)
- [ ] `apps/server/package.json`
- [ ] `apps/server/tsconfig.json`
- [ ] `apps/server/src/index.ts`
- [ ] `apps/server/src/routes/skills.ts`
- [ ] `apps/server/src/middleware/error.ts`
- [ ] `apps/server/src/middleware/auth.ts`

### Tests (5 files)
- [ ] `packages/core/src/services/__tests__/skill-service.test.ts`
- [ ] `packages/core/src/db/adapters/__tests__/bun-sqlite.test.ts`
- [ ] `apps/cli/src/commands/__tests__/skill-list.test.ts`
- [ ] `apps/cli/src/commands/__tests__/skill-create.test.ts`
- [ ] `apps/server/src/routes/__tests__/skills.test.ts`

**Total: ~36 files**

## Acceptance Criteria

1. `bun install` succeeds in < 2s
2. `bun run check` passes (lint + typecheck + test)
3. `bun run test --coverage` shows > 90% coverage
4. CLI `tbs skill create --name "test" --json` creates a skill
5. CLI `tbs skill list --json` lists skills as JSON array
6. API `POST /api/skills` creates a skill, returns 201
7. API `GET /api/skills` lists skills, returns 200
8. API `GET /doc` returns valid OpenAPI 3.0 JSON
9. API `GET /swagger` renders Swagger UI
10. `bun run build:cli` produces binary < 90MB
11. No `any` types, no `console.*` calls, no biome-ignore
12. Database adapter factory works for both bun:sqlite and D1 configs
13. Services are fully driver-agnostic via constructor injection
