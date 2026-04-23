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
- public barrels must not re-export `packages/core/src/db/schema.ts`
- browser-safe and transport code should never know which DB driver is underneath

## 3. Layering Rules

### Allowed in DB infrastructure

- `packages/core/src/db/adapter.ts`
- `packages/core/src/db/client.ts`
- `packages/core/src/db/adapters/*`
- `packages/core/src/db/schema.ts`
- `packages/core/src/db/base-dao.ts`
- `packages/core/src/db/*-dao.ts`
- targeted DB tests under `packages/core/tests/db/**`

### Forbidden outside the DB boundary

- importing `bun:sqlite`
- importing `drizzle-orm/bun-sqlite`
- importing `drizzle-orm/d1`
- importing generic `drizzle-orm*` packages for application behavior
- re-exporting `packages/core/src/db/schema.ts`
- exposing Drizzle database types through public APIs

Enforcement:

```bash
bun run check:db-boundaries
```

That check is also part of:

```bash
bun run check
```

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

DAO classes live in `packages/core/src/db/` and extend `BaseDao`.

Current example:

- `SkillsDao`

Application code should call DAO methods such as:

- `createSkill(...)`
- `listSkills()`

not raw query builders.

## 5. How Application Code Uses the Database

### Server and service code

Use `DbClient` injection and DAO construction:

```ts
import type { DbClient } from '@starter/core';
import { SkillsDao } from '@starter/core';

export function createHandler(db: DbClient) {
    const skillsDao = new SkillsDao(db);
    return skillsDao.listSkills();
}
```

### What not to do

Do not do this in application code:

```ts
import { drizzle } from 'drizzle-orm/d1';
import { skills } from '@starter/core';
```

Do not do this either:

```ts
import { Database } from 'bun:sqlite';
```

Those imports belong to DB infrastructure only.

## 6. How To Add a New DAO

When adding a new database-backed feature:

1. Add or update the table in `packages/core/src/db/schema.ts`
2. Create a DAO in `packages/core/src/db/<domain>-dao.ts`
3. Extend `BaseDao`
4. Expose domain-named methods instead of generic query-builder-shaped methods
5. Inject `DbClient` from callers
6. Add unit tests under `packages/core/tests/db/`
7. Run `bun run check:db-boundaries`
8. Run `bun run check`

Example skeleton:

```ts
import type { DbClient } from './adapter';
import { BaseDao } from './base-dao';
import { widgets } from './schema';

export class WidgetsDao extends BaseDao {
    constructor(db: DbClient) {
        super(db);
    }

    async createWidget(input: { name: string }) {
        const now = this.now();
        return this.db.insert(widgets).values({
            id: crypto.randomUUID(),
            name: input.name,
            createdAt: now,
            updatedAt: now,
        });
    }

    async listWidgets() {
        return this.db.select().from(widgets);
    }
}
```

## 7. Shared DAO Helpers

`BaseDao` should stay thin.

Good `BaseDao` responsibilities:

- `DbClient` storage
- timestamp helpers like `now()`
- small table-agnostic guards if repeated across multiple DAOs

Bad `BaseDao` responsibilities:

- mandatory universal CRUD
- feature-flagged repository behavior
- driver branching
- hiding non-trivial query intent behind generic helper names

If multiple DAOs later repeat the same table-level access pattern, an optional `TableDao<TTable>` may be added under `packages/core/src/db/`, but it must stay narrow and internal to the DB layer.

## 8. Raw SQL

Raw SQL support exists only at the adapter seam:

- `adapter.exec(sql)`
- `adapter.queryFirst(sql)`

Use that only when infrastructure or test setup genuinely needs it.

Do not push raw SQL into route handlers or general application code just because the seam exists.

## 9. Verification Checklist

Before closing DB-access changes:

```bash
bun run check:db-boundaries
bun run test
bun run check
```

If the change touches DAO behavior, also verify:

- route handlers remain thin
- DAO methods stay domain-named
- no schema re-export leaks were introduced
- no Drizzle or `bun:sqlite` imports escaped the DB boundary
