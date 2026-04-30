---
name: Harden job queue claiming and polling indexes
description: Harden job queue claiming and polling indexes
status: Done
created_at: 2026-04-30T00:54:37.067Z
updated_at: 2026-04-30T04:01:13.441Z
folder: docs/tasks
type: task
impl_progress:
  planning: completed
  design: completed
  implementation: completed
  review: completed
  testing: completed
preset: standard
---

## 0025. Harden job queue claiming and polling indexes

### Background

This job queue exists to make background work and scheduled processing easy for generated projects without forcing each project to design its own queue infrastructure. The current DB-backed consumer is useful for a single worker, but it is not safe enough as the starter default because pending jobs are selected and marked processing in separate operations. With multiple consumers, the same job can be observed by more than one worker before either one marks it processing. The implementation also has fragile batch status updates and no index for the polling query shape. This task hardens the queue boundary so generated projects can rely on predictable job claiming, retry behavior, and polling performance.


### Requirements

1. Add a DAO-level atomic claim API for ready jobs that marks at most `batchSize` pending rows as `processing` and returns only the rows this caller actually claimed.
2. Ensure claim eligibility matches existing queue semantics: `status = "pending"` and `next_retry_at` is either `NULL` or less than or equal to the current time.
3. Preserve FIFO-style polling behavior by claiming the oldest eligible jobs first using `created_at` ordering where supported by SQLite/D1-compatible SQL.
4. Update `DBQueueConsumer` to call the atomic claim API directly and process only the claimed rows.
5. Remove or harden the old batch `markProcessing()` path so any remaining batch update uses bound SQL predicates instead of interpolating `ids.join(", ")`.
6. Add tests proving `batchSize > 1` marks and returns multiple jobs correctly.
7. Add tests proving two consecutive claim calls against the same ready queue do not return overlapping job IDs.
8. Add tests proving delayed jobs are not claimed before `next_retry_at`.
9. Add a queue polling index in the Drizzle schema for the ready-job lookup shape, targeting `status`, `next_retry_at`, and `created_at`.
10. Add or generate the corresponding Drizzle migration only after explicit approval, because `drizzle/` migrations are a repository approval boundary.
11. Run `bun run check` and leave only intentional task/code/migration changes in git status.


### Q&A

Auto-refinement run with `--focus all --auto`.

Q: Should this task directly fix the queue implementation or only document future work?
A: Directly fix the queue implementation. The P1 duplicate-processing risk is in starter infrastructure that generated projects are expected to reuse.

Q: Should the implementation target both local SQLite and Cloudflare D1 semantics?
A: Yes. The existing DB abstraction supports both `bun:sqlite` and D1, so the claim SQL and tests should avoid backend-specific behavior unless the adapter explicitly supports it.

Q: Should migrations be included automatically?
A: No. The task should include migration work, but actual `drizzle/` migration changes require explicit approval under the repository contract.

Q: What is out of scope?
A: New queue features such as priorities, dead-letter queues, cron UI, distributed locks outside the database, or changing scheduler adapter APIs.

Q: What preset fits this task?
A: `standard`. The scope is contained to the queue DAO, consumer, schema, tests, and migration coordination; it is more than a trivial patch but not a broad architectural rewrite.


### Design

Use a DAO-level claim operation as the queue boundary:

1. `QueueJobDao.claimReady(batchSize)` performs one atomic update statement:
   - select eligible pending job IDs in `created_at` order with `LIMIT batchSize`
   - update only those IDs to `processing`
   - set `processing_at` and `updated_at`
   - return the updated rows via SQLite `RETURNING`
2. `DBQueueConsumer.processBatch()` calls `claimReady()` and processes only returned rows.
3. Keep `markProcessing()` for existing callers/tests, but harden it with Drizzle `inArray()` and a pending-status predicate so batch IDs are bound safely and already-claimed jobs are not overwritten.
4. Add a Drizzle schema index on `(status, next_retry_at, created_at)` for the polling/claim lookup.
5. Migration generation is intentionally gated by explicit approval because `drizzle/` is protected by the repo contract.


### Solution

Implemented queue hardening for DB-backed consumers:

1. Added `QueueJobDao.claimReady(batchSize)`, which atomically updates eligible pending jobs to `processing` and returns only the rows claimed by that caller.
2. Updated `DBQueueConsumer.processBatch()` to process claimed rows directly instead of selecting pending rows and marking them in a separate operation.
3. Hardened `QueueJobDao.markProcessing(ids)` to use Drizzle `inArray()` with bound IDs and a `status = "pending"` predicate.
4. Added `queue_jobs_ready_idx` to the Drizzle schema over `status`, `next_retry_at`, and `created_at`.
5. Generated the approved migration at `drizzle/0001_salty_red_ghost.sql`.
6. Removed the `drizzle/` ignore rule from `.gitignore` so migration SQL and metadata are visible to Git and can ship with the schema change.
7. Added DAO tests covering multi-ID marking, non-reclaiming behavior, atomic claim batches, non-overlapping consecutive claims, delayed jobs, and non-positive batch sizes.


### Plan

1. Add failing DAO tests for batch claiming, non-overlapping consecutive claims, delayed jobs, and hardened `markProcessing()`.
2. Implement `QueueJobDao.claimReady()` and harden `markProcessing()`.
3. Update `DBQueueConsumer` to use claimed rows directly.
4. Add the queue polling index to the schema.
5. Request approval before creating or editing `drizzle/` migration files.
6. Run targeted queue tests, then `bun run check`.
7. Update task `Solution`, `Testing`, and `Review` sections with evidence before marking done.


### Review

## Verification — 2026-04-29

**Verdict:** PASS

Traceability:

1. Atomic claim API implemented by `QueueJobDao.claimReady()`.
2. Claim eligibility preserves pending + ready retry semantics.
3. Claim ordering uses `created_at` in the bounded subquery.
4. `DBQueueConsumer` now processes only claimed rows.
5. Remaining `markProcessing()` path uses bound `inArray()` and only updates pending jobs.
6. Batch claim and batch mark behavior covered by DAO tests.
7. Consecutive claim calls are covered and do not overlap job IDs.
8. Delayed jobs are covered and remain pending before `next_retry_at`.
9. Schema index added as `queue_jobs_ready_idx`.
10. Approved migration generated under `drizzle/`.
11. `.gitignore` no longer hides `drizzle/`, so migration artifacts are visible for commit.
12. `bun run check` passed.

No unresolved blockers.


### Testing

Verification completed successfully.

Commands run:

```bash
bun test packages/core/tests/db/queue-job-dao.test.ts
bun test packages/core/tests/job-queue/db-consumer.test.ts
bun run typecheck
bun run check
```

Results:

- DAO targeted suite: 16 pass, 0 fail.
- Consumer targeted suite: 13 pass, 0 fail.
- Full repository gate: passed after the final `.gitignore` migration-tracking fix.
- Full coverage run: 781 pass, 0 fail, coverage gate passed.
- Migration drift check: passed.


### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References
