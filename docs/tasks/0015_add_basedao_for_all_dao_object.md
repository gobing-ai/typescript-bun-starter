---
name: add basedao for all dao object
description: add basedao for all dao object
status: Done
created_at: 2026-04-23T17:57:02.830Z
updated_at: 2026-04-23T20:45:00.000Z
folder: docs/tasks
type: task
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---

## 0015. add basedao for all DAO object

### Background
The project already has a database infrastructure seam in `packages/core/src/db/`:

- `adapter.ts` selects the runtime driver (`bun-sqlite` or `d1`)
- `client.ts` exposes the default Bun DB for local and test usage
- `adapters/*` own driver-specific setup
- `schema.ts` owns the table definitions

What is still missing is a stable DAO layer above this seam. Right now application code can still work with the drizzle database directly. That will drift over time and make future migrations harder.

The goal of this task is not to hide every drizzle API behind one giant file. That would be too rigid and would fight the way Drizzle works. The real goal is to enforce a clean layering rule:

- driver-specific imports stay in the DB infrastructure layer
- query logic lives in DAO classes
- application layers consume DAO classes, not raw database handles

This gives us one place to adapt runtime drivers and one place to centralize domain-specific persistence behavior.

This task is now implemented. The current codebase uses:

- a repo-owned `DbClient` seam instead of exposing Drizzle database types to application code
- `BaseDao` and `SkillsDao` under `packages/core/src/db/`
- an automated DB boundary checker that blocks both forbidden imports and schema re-export leaks

### Requirements

#### 1. Introduce a thin `BaseDao`

Add `packages/core/src/db/base-dao.ts` with an abstract `BaseDao` class.

Required contract:

- constructor accepts the existing shared `DbClient` type from `packages/core/src/db/adapter.ts`
- exposes `protected readonly db: DbClient` to subclasses
- may expose small cross-driver-safe helpers such as `now(): number`
- must not expose raw `bun:sqlite` handles
- must not contain driver branching
- must not become a generic repository framework

Design rule:

- `BaseDao` is a minimal seam for dependency injection and shared DAO conventions
- runtime adapter concerns remain in `adapter.ts`, `client.ts`, and `adapters/*`

#### 2. Centralize DAO implementations under `packages/core/src/db/`

Create DAO classes in `packages/core/src/db/` and require every DAO to extend `BaseDao`.

Initial scope:

- add one concrete example DAO for the existing `skills` table
- recommended file: `packages/core/src/db/skills-dao.ts`
- example methods:
  - `createSkill(input)`
  - `listSkills()`

Constraints:

- DAO methods own the drizzle query composition for their table or domain
- callers pass business input and receive typed results
- callers must not assemble SQL or drizzle queries directly

#### 2a. Evolve shared data-access methods in phases

This task should explicitly define how shared DAO helpers may grow over time.

Phase 1: keep `BaseDao` thin.

Allowed `BaseDao` responsibilities:

- injected `DbClient`
- timestamps such as `now()`
- small cross-cutting helpers that are truly table-agnostic
- lightweight guard helpers such as `requireFound(...)` only if repeated in multiple DAOs

Phase 2: add an optional generic table-aware base only after duplication is proven.

Precondition:

- at least 2-3 DAO classes repeat the same table-level access patterns

Recommended shape:

- add an optional `TableDao<TTable>` or similarly narrow helper under `packages/core/src/db/`
- use it only for simple repeated operations such as `insertOne` or `selectAll`
- keep domain-named DAO methods as the public API

Rules for any generic table-aware base:

- it must stay internal to the DB layer
- it must be opt-in, not mandatory for every DAO
- it must not absorb domain-specific behavior
- it must not grow flags or configuration knobs to simulate every table shape

Explicit anti-patterns:

- mandatory universal CRUD base for all DAOs
- generic repository layer with feature flags such as `hasSoftDelete`, `timestampColumns`, or `nameColumn`
- abstractions that hide query intent and make non-trivial queries harder to express

#### 3. Enforce layering boundaries

Define the following architectural rule:

- `bun:sqlite`, `drizzle-orm/bun-sqlite`, and `drizzle-orm/d1` are only allowed in DB infrastructure files
- generic drizzle imports for query building should stay inside `packages/core/src/db/**`
- `apps/*` and non-DB package code must not import drizzle packages directly for application behavior
- public barrels and application code must not re-export `packages/core/src/db/schema.ts`
- end-client code must depend on `DbClient`, not Drizzle database types

Allowed DB infrastructure files:

- `packages/core/src/db/adapter.ts`
- `packages/core/src/db/client.ts`
- `packages/core/src/db/adapters/*`
- `packages/core/src/db/schema.ts`
- `packages/core/src/db/base-dao.ts`
- `packages/core/src/db/*-dao.ts`
- targeted test helpers under `packages/core/tests/db/**` and app test setup where unavoidable

Implementation requirement:

- add an automated boundary check rather than relying on documentation only
- recommended approach: a small script under `scripts/` that scans imports with `rg`
- wire the boundary check into `bun run check`

#### 4. Integrate the DAO into current application code

Replace direct DB usage in the current skills HTTP handlers with the example DAO.

Required outcome:

- route handlers keep request and response responsibilities only
- persistence logic moves into the DAO
- routes construct the DAO from the already-injected `db`

#### 5. Export and document the pattern

Update `packages/core/src/index.ts` exports so the DAO pattern is usable by other workspaces.

Document:

- where DAO classes live
- who may import the raw DB types
- how new features should add a DAO
- why `BaseDao` stays intentionally small
- why `DbClient` is the public DB seam
- why schema objects must not leak through public exports

#### 6. Non-goals

This task should explicitly avoid:

- adding a heavy repository or unit-of-work abstraction
- introducing a generic CRUD base class with speculative helpers
- moving schema definitions out of `schema.ts`
- forcing all drizzle symbols through one single file
- solving cross-driver transaction semantics in v1

#### Acceptance Criteria

1. `BaseDao` exists under `packages/core/src/db/base-dao.ts`
2. At least one real DAO exists and extends `BaseDao`
3. Skills HTTP handlers use the DAO instead of raw query composition
4. Public and application-facing code depend on `DbClient`, not Drizzle database types
5. There is an automated boundary check for forbidden DB imports and schema re-export leaks
6. `bun run check` passes
7. Documentation explains the DAO boundary for future contributors

### Q&A

#### Q: Should `BaseDao` live at `packages/core/src/basedao.ts`?

No. Put it in `packages/core/src/db/base-dao.ts` so the file stays aligned with the existing DB module layout.

#### Q: Should all `drizzle-orm` imports be banned outside `BaseDao`?

No. That rule is too strict and would make DAO implementation awkward. The correct boundary is:

- driver or runtime imports belong to DB infrastructure only
- generic drizzle query composition belongs inside DAO and schema files
- application layers should not import drizzle directly
- public barrels should not expose schema objects or Drizzle database types

#### Q: Should `BaseDao` include common generic CRUD methods now?

Not yet. `BaseDao` should stay thin until we have at least 2-3 DAOs showing real duplication. When that happens, add a second optional generic helper such as `TableDao<TTable>` rather than bloating `BaseDao` itself.

#### Q: Should `BaseDao` include transaction helpers now?

No. `bun-sqlite` and D1 do not share the same operational semantics cleanly enough to justify a premature abstraction here. Add transaction helpers only when there is a concrete multi-step use case and verified support across target drivers.

#### Q: Should DAOs use a singleton DB internally?

No. DAOs should receive `DbClient` through construction. That keeps test setup explicit and works with both the default Bun adapter and request-scoped D1 injection.

#### Q: Should this task introduce service classes too?

No. This task is only about defining the persistence boundary. Services can sit above DAOs later if domain orchestration becomes non-trivial.

### Design

#### Option A. Thin `BaseDao` + concrete DAOs + boundary check

Summary:

- keep the existing adapter and client layer
- add a minimal abstract base class
- move table-specific persistence into concrete DAO classes
- enforce import boundaries with an automated check

Pros:

- matches the current architecture
- works for both Bun SQLite and D1 without extra indirection
- easy to adopt incrementally
- low long-term maintenance cost

Cons:

- does not eliminate all drizzle knowledge from the core package
- transaction patterns remain a later concern

Confidence: High

#### Option B. Static DAO modules without inheritance

Summary:

- use plain functions such as `createSkillsDao(db)` or exported query helpers
- skip `BaseDao` entirely

Pros:

- very simple
- no inheritance

Cons:

- does not satisfy the stated requirement of a shared base class
- weaker convention for future contributors
- less room for shared guardrails and helper methods

Confidence: Medium

#### Option C. Full repository framework and unit-of-work layer

Summary:

- hide drizzle behind a larger abstraction with generic repositories, transactions, and factories

Pros:

- can produce a very strict persistence API

Cons:

- over-engineered for this starter
- higher risk of leaking false abstractions across Bun and D1
- would slow future feature work

Confidence: Low

#### Recommended Design

Choose Option A.

It is the only option that is both aligned with the requirement and proportionate to this repo. The current adapter layer already solves runtime selection. The missing piece is a DAO convention and an enforcement mechanism, not a bigger framework.

#### Recommended Evolution Rule

Adopt a two-layer rule:

1. `BaseDao` remains the permanent thin root for all DAOs.
2. A generic `TableDao<TTable>` may be introduced later, but only after repeated table-level duplication appears across multiple DAOs.

This preserves a unified access style without locking the codebase into a premature universal repository abstraction.

### Solution

#### Deliverables

1. Add `packages/core/src/db/base-dao.ts`
2. Add `packages/core/src/db/skills-dao.ts`
3. Update `apps/server/src/index.ts` to call the DAO
4. Replace the public Drizzle database surface with `DbClient` in `packages/core/src/db/adapter.ts`
5. Export the new DAO artifacts from `packages/core/src/index.ts` without re-exporting `db/schema.ts`
6. Add a boundary-check script, then wire it into `package.json`
7. Add tests for the DAO, adapter seam, and boundary expectations

#### Proposed shape

```ts
// packages/core/src/db/base-dao.ts
import type { DbClient } from './adapter';

export abstract class BaseDao {
    protected constructor(protected readonly db: DbClient) {}

    protected now(): number {
        return Date.now();
    }
}
```

```ts
// packages/core/src/db/table-dao.ts (optional future evolution)
import type { DbClient, DbTable } from './adapter';
import { BaseDao } from './base-dao';

export abstract class TableDao<TTable extends DbTable<unknown, unknown>> extends BaseDao {
    protected constructor(
        db: DbClient,
        protected readonly table: TTable,
    ) {
        super(db);
    }

    protected insertOne(values: TTable['$inferInsert']) {
        return this.db.insert(this.table).values(values);
    }

    protected selectAll(): Promise<TTable['$inferSelect'][]> {
        return this.db.select().from(this.table);
    }
}
```

Current implemented shape:

- `packages/core/src/db/adapter.ts`
  - defines `DbClient`, `DbTable`, and `DbAdapter`
  - keeps Drizzle types internal to DB infrastructure
- `packages/core/src/db/base-dao.ts`
  - defines the thin DAO root
- `packages/core/src/db/skills-dao.ts`
  - centralizes `skills` persistence behind domain-named methods
- `apps/server/src/index.ts`
  - consumes `DbClient` and `SkillsDao`
- `scripts/check-db-boundaries.ts`
  - rejects forbidden DB imports outside the DB boundary
  - rejects schema re-export leaks outside the DB boundary

Important constraint:

- keep the API intentionally small until there are at least two DAOs with duplicated behavior that justifies additional helpers
- if a generic `TableDao<TTable>` is added later, DAO public methods must still be domain-named

### Plan

Completed implementation steps:

1. Added `BaseDao` in `packages/core/src/db/`
2. Added `SkillsDao`
3. Replaced the public Drizzle DB surface with `DbClient`
4. Refactored `apps/server/src/index.ts` to use `SkillsDao`
5. Added automated boundary checking for forbidden imports and schema re-export leaks
6. Added DAO, adapter, and boundary tests
7. Ran `bun run check`

### Review

Primary risks to check during implementation:

- accidentally introducing driver-specific assumptions into `BaseDao`
- letting route handlers keep query composition after DAO introduction
- making the boundary rule so strict that tests or schema code become painful
- expanding `BaseDao` with speculative helpers before duplication exists
- introducing a generic CRUD base before the codebase has enough real DAO repetition to justify it

Implementation review outcome:

- `BaseDao` stayed thin
- `DbClient` now hides Drizzle database types from client code
- `packages/core/src/index.ts` no longer re-exports `db/schema.ts`
- boundary checks now enforce both import and schema re-export rules

Review questions:

- Does every new DAO extend `BaseDao`?
- Are shared DAO helpers backed by real duplication rather than speculation?
- If a generic `TableDao<TTable>` exists, is it still narrow and optional?
- Is any application code outside `packages/core/src/db/**` importing drizzle directly?
- Is the DAO API business-oriented rather than query-builder-oriented?
- Can the same DAO class run unchanged with Bun SQLite and D1?

### Testing

Required verification:

- unit test `SkillsDao` against the existing in-memory DB test helper
- server tests continue to pass with DAO-backed handlers
- automated import-boundary check passes
- final gate: `bun run check`

Suggested test cases:

- `createSkill()` inserts a row with expected timestamps
- `listSkills()` returns inserted rows
- route `POST /api/skills` still returns `201`
- route `GET /api/skills` still returns stored rows
- forbidden import examples are caught by the boundary checker

Actual verification completed:

- `packages/core/tests/db/base-dao.test.ts`
- `packages/core/tests/db/skills-dao.test.ts`
- `packages/core/tests/db/adapter.test.ts`
- `packages/core/tests/db/adapters/bun-sqlite.test.ts`
- `packages/core/tests/db/client.test.ts`
- `packages/core/tests/db/check-db-boundaries.test.ts`
- `apps/server/tests/index.test.ts`
- `bun run check`

### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |
| Task refinement | `docs/tasks/0015_add_basedao_for_all_dao_object.md` | Codex | 2026-04-23 |
| Implementation | `packages/core/src/db/base-dao.ts` | Codex | 2026-04-23 |
| Implementation | `packages/core/src/db/skills-dao.ts` | Codex | 2026-04-23 |
| Implementation | `packages/core/src/db/adapter.ts` | Codex | 2026-04-23 |
| Implementation | `apps/server/src/index.ts` | Codex | 2026-04-23 |
| Verification | `scripts/check-db-boundaries.ts` | Codex | 2026-04-23 |
| Verification | `packages/core/tests/db/check-db-boundaries.test.ts` | Codex | 2026-04-23 |

### References

- Existing DB infrastructure: `packages/core/src/db/adapter.ts`
- Thin DAO root: `packages/core/src/db/base-dao.ts`
- Example DAO: `packages/core/src/db/skills-dao.ts`
- Existing default DB client: `packages/core/src/db/client.ts`
- Existing server DB usage: `apps/server/src/index.ts`
