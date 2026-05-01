---
name: Add queue heartbeat endpoint
description: Add queue heartbeat endpoint
status: Done
created_at: 2026-05-01T20:21:35.312Z
updated_at: 2026-05-01T20:28:39.697Z
folder: docs/tasks
type: task
impl_progress:
  planning: pending
  design: pending
  implementation: pending
  review: pending
  testing: pending
---

## 0027. Add queue heartbeat endpoint

### Background

The DBJobQueue and DBQueueConsumer infrastructure exists but is not surfaced to operators. There is no way to inspect queue health (pending, processing, completed, failed counts) via the API. Adding a GET /api/health/queue heartbeat endpoint gives operators visibility into async job processing without requiring consumer startup.


### Requirements

- [x] **R1 — Add getStats() to QueueJobDao**: GROUP BY status query returning QueueStats → **MET** | Evidence: `packages/core/src/db/queue-job-dao.ts:86-113`
- [x] **R2 — Add GET /api/health/queue route**: Hono OpenAPI route → **MET** | Evidence: `apps/server/src/index.ts:110-120`
- [x] **R3 — Test coverage**: DAO stats test + endpoint integration test → **MET** | Evidence: `packages/core/tests/db/queue-job-dao-stats.test.ts` (3 tests), `apps/server/tests/endpoints/health-queue.test.ts` (2 tests)
- [x] **R4 — Document endpoint**: User manual API Reference → **MET** | Evidence: `docs/03_USER_MANUAL.md:252-262`

**Verdict:** PASS — All 4 requirements MET.

Add getStats() to QueueJobDao returning all four status counts in one query. Create GET /api/health/queue endpoint on the server returning QueueStats. Document the endpoint in API Reference section of user manual. Include test coverage for the DAO method and the endpoint.


### Q&A



### Design

**Option A — Passive heartbeat only** (selected by operator)

Add a read-only endpoint that queries the `queue_jobs` table and returns aggregate counts. The queue consumer is NOT auto-started — users opt into that separately. This keeps the endpoint side-effect-free: it always works, even when the queue is idle.

**Integration points:**
1. `QueueJobDao.getStats()` — new method returning `QueueStats` via a single `GROUP BY status` query
2. `GET /api/health/queue` — Hono route that creates a `QueueJobDao` from the request-scoped `DbClient` and calls `getStats()`
3. User manual — add endpoint to API Reference section alongside existing `/api/health`

**Scope:** Core data layer + server route layer. No consumer wiring, no cron, no auto-start.


### Solution

**Files changed:**

```
NEW  packages/core/tests/db/queue-job-dao-stats.test.ts   # Test getStats() with various statuses
MOD  packages/core/src/db/queue-job-dao.ts                # Add getStats(): Promise<QueueStats>
MOD  apps/server/src/index.ts                             # Add GET /api/health/queue route
NEW  apps/server/tests/endpoints/health-queue.test.ts     # Test the endpoint
MOD  docs/03_USER_MANUAL.md                               # Document endpoint in API Reference
```

**getStats() implementation:**

```ts
// queue-job-dao.ts
async getStats(): Promise<QueueStats> {
  return this.withMetrics('select', 'queue_jobs', async () => {
    const rows = await this.db
      .select({ status: queueJobs.status, count: sql`count(*)` })
      .from(queueJobs)
      .groupBy(queueJobs.status);
    
    const map = Object.fromEntries(rows.map(r => [r.status, Number(r.count)]));
    return {
      pending: map.pending ?? 0,
      processing: map.processing ?? 0,
      completed: map.completed ?? 0,
      failed: map.failed ?? 0,
    };
  });
}
```

**Route shape:**

```ts
// GET /api/health/queue → ApiSuccessEnvelope<QueueStats>
const apiHealthQueueRoute = createRoute({
  method: 'get',
  path: '/api/health/queue',
  responses: {
    200: {
      content: { 'application/json': { schema: successEnvelopeSchema(queueStatsSchema) } },
      description: 'Queue health statistics',
    },
  },
});

app.openapi(apiHealthQueueRoute, async (c) => {
  const dao = new QueueJobDao(c.var.db);
  const stats = await dao.getStats();
  return c.json(successResponse(stats), 200);
});
```


### Plan

1. Add `getStats()` to `QueueJobDao` — `GROUP BY status` query returning `QueueStats`
2. Add `GET /api/health/queue` OpenAPI route to server
3. Write tests: DAO stats test + endpoint integration test
4. Document endpoint in user manual
5. Run `bun run check` — all gates pass



### Review — 2026-05-01

**Status:** 0 findings  
**Scope:** Queue heartbeat endpoint — `packages/core/src/db/queue-job-dao.ts`, `apps/server/src/index.ts`, tests  
**Mode:** verify  
**Channel:** inline  
**Gate:** `bun run check` → pass (791 tests, 0 fail, coverage green)

**Verdict:** PASS — No SECU findings. All 4 requirements MET.




### Testing



### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References


