# Database Access Guide

> Canonical guide for how this starter structures database access. This file documents the design as-shipped, not hypothetical future layers.

## 1. Design Goal

Database access in this starter is intentionally split into two layers:

- **DB infrastructure** owns runtime drivers, adapter wiring, schema definitions, and raw SQL seams
- **DAO classes** own query composition and expose domain-named methods to application code

Application code should depend on DAOs and the repo-owned `DbClient` seam, not on Drizzle or `bun:sqlite` directly.

## 2. Public Seam

The public database seam is defined in `packages/core/src/db/adapter.ts`.

Key types:

- `DbClient` — the application-facing database client contract
- `DbTable` — the narrow table type used by the DB layer
- `DbAdapter` — the runtime adapter interface for Bun SQLite and D1

This is deliberate:

- app code must not import Drizzle database types
- public barrels must not re-export schema files
- browser-safe and transport code should never know which DB driver is underneath

## 3. Layering Rules

### Allowed in DB infrastructure

- `packages/core/src/db/adapter.ts`
- `packages/core/src/db/client.ts`
- `packages/core/src/db/adapters/*`
- `packages/core/src/db/schema/**`
- `packages/core/src/db/columns.ts` (re-exports from `schema/common.ts`)
- `packages/core/src/db/base-dao.ts`
- `packages/core/src/db/entity-dao.ts`
- `packages/core/src/db/*-dao.ts`
- `packages/core/src/db/migrate.ts`
- targeted DB tests under `packages/core/tests/db/**`

### Forbidden outside the DB boundary

- importing `bun:sqlite`
- importing `drizzle-orm/bun-sqlite`
- importing `drizzle-orm/d1`
- importing generic `drizzle-orm*` packages for application behavior
- re-exporting schema files (schema re-export leaks)
- exposing Drizzle database types through public APIs

Enforcement is via the `db-boundaries` policy:

```bash
bun run check:db-boundaries
```

That check is also part of:

```bash
bun run check
```

The policy prevents schema re-export leaks and enforces that all DB primitives stay within the boundary.

## 4. Runtime Structure

### Adapters

Runtime driver details stay in `packages/core/src/db/adapters/*`.

- `bun-sqlite.ts` owns Bun SQLite construction and pragmas
- `d1.ts` owns Cloudflare D1 construction

These files may use driver-specific imports and keep those details internal.

### Client

`packages/core/src/db/client.ts` exposes the default local adapter for Bun-backed development and tests.

- `getDefaultAdapter()` returns the singleton adapter
- `getDb()` returns the default `DbClient`

### DAO layer

DAO classes live in `packages/core/src/db/` and extend `EntityDao` (which extends `BaseDao`).

`EntityDao` provides generic CRUD operations (create, findById, findAll, update, delete, list, count) with automatic soft-delete filtering.

Concrete DAOs add domain-specific methods:

```ts
export class QueueJobDao extends EntityDao<typeof queueJobs, typeof queueJobs.id> {
    constructor(db: DbClient) {
        super(db, queueJobs, queueJobs.id, 'queue_jobs');
    }

    async enqueue(type: string, payload: unknown) { /* ... */ }
    async findPending(batchSize: number) { /* ... */ }
}
```

## 5. Schema Organization

Table definitions live in `packages/core/src/db/schema/`:

```
schema/
├── index.ts          ← barrel re-exporting all tables and column helpers
├── common.ts         ← standardColumns, standardColumnsWithSoftDelete
└── queue-jobs.ts     ← queueJobs table definition
```

### Adding a new table

1. Create a new file in `packages/core/src/db/schema/` (e.g., `users.ts`)
2. Define the table using `sqliteTable()` from `drizzle-orm/sqlite-core`
3. Spread `...standardColumns` (or `...standardColumnsWithSoftDelete`) for consistent timestamps
4. Re-export from `schema/index.ts`
5. Run `bun run db:generate` to create the migration
6. Commit the migration files in `drizzle/`

```ts
// packages/core/src/db/schema/users.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { standardColumns } from './common';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    ...standardColumns,
});
```

```ts
// packages/core/src/db/schema/index.ts
export * from './common';
export * from './queue-jobs';
export * from './users';   // ← add this
```

### Column helpers

`standardColumns` and `standardColumnsWithSoftDelete` are defined in `schema/common.ts` and provide:

| Helper | Columns |
|--------|---------|
| `standardColumns` | `createdAt`, `updatedAt` (integer ms) |
| `standardColumnsWithSoftDelete` | `createdAt`, `updatedAt`, `inUsed` (1=active, 0=deleted) |

`EntityDao` automatically filters by `inUsed = 1` when the table has the `inUsed` column.

## 6. Migration Workflow

### Drizzle config

`drizzle.config.ts` points to the schema directory with a glob:

```ts
schema: './packages/core/src/db/schema/**/*.ts'
```

### Commands

| Command | Purpose |
|---------|---------|
| `bun run db:push` | Rapid dev — push schema changes directly to DB (no migration files) |
| `bun run db:generate` | Generate versioned migration SQL files from schema diff |
| `bun run db:migrate` | Apply generated migration files to the database |
| `bun run db:check-drift` | Verify schema and migrations are in sync (used in CI) |
| `bun run db <cmd>` | Pass-through to any drizzle-kit command (`studio`, `check`, `drop`, `up`, `introspect`, `export`) |

### Development workflow

**Rapid iteration (local dev):**
```bash
bun run db:push    # push schema directly, skip migration files
```

**Production-ready (commit migrations):**
```bash
bun run db:generate          # creates drizzle/NNNN_name.sql + snapshot
bun run db:migrate           # applies to local DB
git add drizzle/             # commit migration files
```

**CI drift detection:**
```bash
bun run db:check-drift       # fails if schema changed without new migration
```

This is included in `bun run check` and catches the exact scenario where a table is added to the schema but `db:generate` is never run.

### In-app migrations

The server supports automatic migrations at startup via the `AUTO_MIGRATE` env var:

```bash
AUTO_MIGRATE=1 bun run dev:server
```

This calls `applyMigrations()` from `@starter/core` before serving requests. Only works with `bun-sqlite` adapter — D1 migrations should use `wrangler d1 migrations apply` instead.

Default: **off**. Production should run migrations as a deliberate deployment step.

### Migration history management

**Remove a bad migration (before applying):**
```bash
bun run db drop              # removes the latest migration file from disk
```

**Squash migrations (early-stage projects):**
1. Delete all files in `drizzle/` and `drizzle/meta/`
2. Run `bun run db:generate --name=init`
3. Commit the fresh single migration

**Point-in-time recovery:**
Migration rollback is not supported by drizzle-kit. If you need to undo an applied migration, write corrective SQL as a new forward migration.

## 7. How Application Code Uses the Database

### Server and service code

Use `DbClient` injection and DAO construction:

```ts
import type { DbClient } from '@starter/core';
import { QueueJobDao } from '@starter/core';

export function createHandler(db: DbClient) {
    const dao = new QueueJobDao(db);
    return dao.findPending(10);
}
```

### What not to do

Do not do this in application code:

```ts
import { drizzle } from 'drizzle-orm/d1';
import { queueJobs } from '@starter/core/db/schema';
```

Do not do this either:

```ts
import { Database } from 'bun:sqlite';
```

Those imports belong to DB infrastructure only.

## 8. How To Add a New DAO

When adding a new database-backed feature:

1. Add or update the table in `packages/core/src/db/schema/<domain>.ts`
2. Re-export from `packages/core/src/db/schema/index.ts`
3. Create a DAO in `packages/core/src/db/<domain>-dao.ts`
4. Extend `EntityDao<typeof table, typeof table.id>`
5. Expose domain-named methods
6. Inject `DbClient` from callers
7. Add unit tests under `packages/core/tests/db/`
8. Run `bun run check`

Example skeleton:

```ts
import type { DbClient } from './adapter';
import { EntityDao } from './entity-dao';
import { users } from './schema';

export class UsersDao extends EntityDao<typeof users, typeof users.id> {
    constructor(db: DbClient) {
        super(db, users, users.id, 'users');
    }

    async findByEmail(email: string) {
        return this.findBy(users.email, email);
    }
}
```

## 9. Shared DAO Helpers

`BaseDao` provides:
- `DbClient` storage
- `now()` timestamp helper
- `withTransaction(fn)` — works on both D1 and bun:sqlite
- `withMetrics(operation, collection, fn)` — OTel span + metrics

`EntityDao` extends `BaseDao` with generic CRUD:
- `create(data)` — auto-fills `createdAt`/`updatedAt`
- `findById(id)` — by primary key
- `findAll()` — all records
- `findBy(column, value)` — first match
- `findAllBy(column, value)` — all matches
- `update(id, data)` — auto-updates `updatedAt`
- `delete(id, soft?)` — hard or soft delete
- `list({ limit, offset })` — paginated
- `count()` — record count

## 10. Raw SQL

Raw SQL support exists only at the adapter seam:

- `adapter.exec(sql)`
- `adapter.queryFirst(sql)`

Use that only when infrastructure or test setup genuinely needs it.

## 11. Verification Checklist

Before closing DB-access changes:

```bash
bun run check
```

This runs:
- Biome lint + format
- Policy checks (including `db-boundaries`)
- Schema drift detection (`db:check-drift`)
- TypeScript type checking
- Full test suite with coverage
