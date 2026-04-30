---
name: Simplify and Standardize Database Schema Migrations
description: Streamline drizzle-kit migration workflow, fix schema drift, add in-app migration runner, split schema files, and enforce migration hygiene in CI
status: Done
created_at: 2026-04-29T17:00:00.000Z
updated_at: 2026-04-29T17:00:00.000Z
folder: docs/tasks
type: task
impl_progress:
  planning: pending
  design: pending
  implementation: pending
  review: pending
  testing: pending
---

## 0024. Simplify and Standardize Database Schema Migrations

### Background

The codebase has a solid database access layer (DbAdapter, BaseDao, EntityDao, standardColumns) but the migration workflow has gaps:

1. **Schema/migration drift** — The `queue_jobs` table is defined in `schema.ts` but missing from the generated migration (`drizzle/0000_classy_deathbird.sql` only creates `skills`). This means `drizzle-kit generate` was never re-run after adding `queue_jobs`, or `push` was used without regenerating migration files.

2. **No in-app migration runner** — Production deployments rely on running `drizzle-kit migrate` as a CLI step. There's no programmatic `migrate()` call at server startup, which means migrations must be run as a separate deployment step.

3. **Monolithic schema file** — All table definitions live in a single `packages/core/src/db/schema.ts`. As the project grows, this file will become unwieldy.

4. **No CI drift detection** — CI runs `bun run check` but doesn't verify that `drizzle-kit generate` produces an empty diff (i.e., schema and migrations are in sync).

5. **Demo artifacts removed** — The `skills` table and `SkillsDao` were removed as demo code (task completed 2026-04-29), but the migration file still references the `skills` table. The migration history needs cleanup.

6. **Migration scripts gap** — `db:studio`, `db:check`, `db:drop`, `db:up` were just added to package.json. Need to verify they work correctly and document their usage.

### Requirements

#### R1: Fix migration drift
- Regenerate migrations so `queue_jobs` is included
- Either squash the history (drop old migration, create fresh one) or add a new migration for `queue_jobs`
- Remove the stale `skills` table reference from migration history if the table is no longer needed

#### R2: Add in-app migration runner
- Create `packages/core/src/db/migrate.ts` that uses `drizzle-orm/migrate()` to apply pending migrations at startup
- Support both bun:sqlite and D1 backends (D1 may need different approach via wrangler)
- Add a `db:migrate:app` script that runs migrations programmatically
- Server entry point should call migrate on startup (configurable via env var)

#### R3: Split schema into per-domain files
- Create `packages/core/src/db/schema/` directory
- Split `schema.ts` into domain files: `queue-jobs.ts`, `common.ts` (re-exports standardColumns)
- Create `packages/core/src/db/schema/index.ts` barrel that re-exports all tables
- Update `drizzle.config.ts` schema path to use glob (`./packages/core/src/db/schema/**/*.ts`)
- Update all imports across the codebase

#### R4: Add CI drift detection
- Add a CI step that runs `drizzle-kit generate` and checks that no new migration files are produced
- If new files are generated, CI fails with a message: "Schema changed but migrations not regenerated. Run `bun run db:generate`."
- This catches the exact drift scenario that happened with `queue_jobs`

#### R5: Document migration workflow
- Update `docs/05_DATABASE_ACCESS.md` with:
  - How to add a new table (define in schema → run `db:generate` → commit migration)
  - How to run migrations in dev (`db:push` for rapid iteration, `db:generate` + `db:migrate` for production)
  - How in-app migrations work at startup
  - How CI detects drift
- Add a `CONTRIBUTING.md` section or update existing docs with migration conventions

#### R6: Migration history management
- Document when to use `drizzle-kit drop` to remove a bad migration
- Document when to squash migrations (for early-stage projects)
- Add `db:squash` script if drizzle-kit supports it, or document manual squash procedure

### Q&A

**Q: Should we squash the existing migration history or add a new migration?**
A: Since this is a starter project in early development, squashing is acceptable. Drop the existing migration, regenerate from the current schema. Document this decision.

**Q: Should in-app migrations run automatically at server startup?**
A: Make it opt-in via `AUTO_MIGRATE=1` env var. Default off for safety — production should run migrations as a deliberate step. Dev/CI can enable auto-migrate.

**Q: Should schema files be per-table or per-domain?**
A: Per-domain. Group related tables (e.g., `queue-jobs.ts` for queue_jobs, future `users.ts` for user-related tables). Keep `common.ts` for shared column helpers.

**Q: How should D1 migrations work in-app?**
A: D1 migrations are typically run via `wrangler d1 migrations apply`. For in-app, we can use `drizzle-orm/migrate()` with the D1 binding. Document both approaches.

### Design

#### File structure after changes:

```
packages/core/src/db/
├── adapters/
│   ├── bun-sqlite.ts
│   └── d1.ts
├── schema/
│   ├── index.ts          ← barrel re-exporting all tables
│   ├── common.ts         ← standardColumns, standardColumnsWithSoftDelete
│   └── queue-jobs.ts     ← queueJobs table
├── adapter.ts
├── base-dao.ts
├── client.ts
├── entity-dao.ts
├── migrate.ts            ← NEW: programmatic migration runner
├── queue-job-dao.ts
└── span-context.ts
```

#### Migration runner API:

```typescript
// packages/core/src/db/migrate.ts
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

export interface MigrationOptions {
    /** Path to migration SQL files. Default: './drizzle' */
    migrationsFolder?: string;
}

/**
 * Apply pending migrations using drizzle-orm's built-in migrator.
 * Tracks applied migrations in __drizzle_migrations table.
 */
export async function applyMigrations(
    db: BunSQLiteDatabase,
    options?: MigrationOptions,
): Promise<void> {
    const folder = options?.migrationsFolder ?? './drizzle';
    migrate(db, { migrationsFolder: folder });
}
```

#### CI drift check script:

```typescript
// scripts/check-migration-drift.ts
// 1. Run `drizzle-kit generate`
// 2. Check if any new files were created in drizzle/
// 3. If yes, fail with instructions
// 4. Clean up generated files
```

#### Server startup integration:

```typescript
// apps/server/src/index.ts (in createApp)
if (process.env.AUTO_MIGRATE === '1') {
    const { applyMigrations } = await import('@starter/core/db/migrate');
    // ... apply migrations before serving requests
}
```

### Plan

- [x] **Step 1**: Fix migration drift
  - [x] Delete `drizzle/0000_classy_deathbird.sql` and `drizzle/meta/`
  - [x] Run `bun run db:generate --name=init` to create fresh migration from current schema
  - [x] Verify new migration includes `queue_jobs` only (skills table removed)
  - [x] Run `bun run db:push` against a test DB to verify schema applies cleanly

- [x] **Step 2**: Split schema files
  - [x] Create `packages/core/src/db/schema/` directory
  - [x] Move `standardColumns` and `standardColumnsWithSoftDelete` to `schema/common.ts`
  - [x] Move `queueJobs` table to `schema/queue-jobs.ts`
  - [x] Create `schema/index.ts` barrel
  - [x] Delete old `packages/core/src/db/schema.ts`
  - [x] Update `drizzle.config.ts` schema path to glob
  - [x] Update `columns.ts` to re-export from `schema/common.ts` (backward compat)
  - [x] Run `bun run typecheck && bun run test:coverage` — 702 tests pass

- [x] **Step 3**: Add in-app migration runner
  - [x] Create `packages/core/src/db/migrate.ts`
  - [x] Export from `packages/core/src/index.ts`
  - [x] Add `AUTO_MIGRATE` support to server entry point
  - [x] Add unit test for migrate.ts
  - [x] Add `db:migrate:app` script to package.json

- [x] **Step 4**: Add CI drift detection
  - [x] Create `scripts/check-migration-drift.ts`
  - [x] Add `db:check-drift` script and integrate into `bun run check`
  - [x] Verified: passes when schema matches, would fail on drift

- [x] **Step 5**: Update documentation
  - [x] Rewrite `docs/05_DATABASE_ACCESS.md` with full migration workflow
  - [x] Document `db:push` vs `db:generate` + `db:migrate` usage
  - [x] Document `AUTO_MIGRATE` env var
  - [x] Document CI drift detection and schema organization

- [x] **Step 6**: Verify
  - [x] `bun run check` passes (lint + typecheck + test + policy + drift + docs)
  - [x] `bun run db:check-drift` passes (no drift)
  - [x] `bun run db:generate` produces empty diff
  - [x] 704 tests pass, 0 failures, all coverage gates met

### Review

All changes verified via `bun run check`:
- Biome lint + format: 0 errors
- 9/9 policies pass (including new drift policies)
- Schema drift check: no drift
- TypeScript: 0 errors
- 704 tests pass, 0 failures
- Coverage gate: all files >= 90%

### Testing

- `bun run db:check-drift` — verified no drift after schema split
- `bun run db:generate` — confirmed empty diff
- `applyMigrations()` — tested with bun:sqlite adapter (no-op for non-BunSqliteAdapter)
- `bun run check` — full gate passes clean

### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References

- [Drizzle ORM Bun SQLite docs](https://orm.drizzle.team/docs/get-started/bun-sqlite-new)
- [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [Drizzle Kit push](https://orm.drizzle.team/docs/drizzle-kit-push)
- `docs/05_DATABASE_ACCESS.md` — existing DB access guide
- `policies/db-boundaries.json` — migration drift policies (just added)
- `packages/core/src/db/schema.ts` — current monolithic schema
- `drizzle.config.ts` — drizzle-kit configuration
