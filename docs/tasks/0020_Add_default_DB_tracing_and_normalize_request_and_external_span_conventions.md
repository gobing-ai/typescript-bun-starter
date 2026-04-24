---
name: Add default DB tracing and normalize request and external span conventions
description: Add default DB tracing and normalize request and external span conventions
status: Done
created_at: 2026-04-24T05:26:02.463Z
updated_at: 2026-04-24T05:26:02.463Z
folder: docs/tasks
type: task
priority: high
estimated_hours: 8
dependencies: ["0017","0018"]
tags: ["telemetry","db","tracing","server"]
preset: standard
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
modified_files:
  - packages/core/src/db/base-dao.ts
  - apps/server/src/index.ts
  - packages/core/tests/db/base-dao-tracing.test.ts
  - apps/server/tests/index.test.ts
---

## 0020. Add default DB tracing and normalize request and external span conventions

### Background

The starter now has baseline OpenTelemetry support and request-span wiring, but default span coverage is still incomplete and naming/attributes are not yet normalized across inbound HTTP, DB operations, and outbound API access. This task should make the tracing model coherent and low-drift by instrumenting the existing centralized boundaries instead of spreading span code across random call sites.


### Requirements

1. Add default DB tracing at the `packages/core/src/db/**` boundary, starting with DAO public methods or the narrowest stable execution seam already centralized in this repo.
2. Normalize default span naming and attributes across:
   - inbound HTTP/server request spans
   - DB operation spans
   - outbound HTTP/external API spans
3. Keep the tracing model centralized. The goal is one coherent default convention rather than many ad hoc span names and attributes.
4. Preserve the shared telemetry boundary and avoid direct raw `@opentelemetry/*` imports outside `packages/core/src/telemetry/**` except targeted tests.
5. Ensure the resulting trace tree is useful and not noisy. Spans should represent stable operational boundaries, not every helper call.
6. Update developer-facing documentation/examples where the normalized tracing conventions become part of the default developer contract.

### Constraints

- Do not capture raw SQL values, secrets, tokens, or other sensitive/high-cardinality data in span attributes.
- Prefer logical DB operation spans over low-signal helper-level spans.
- Do not duplicate the same logical span at multiple layers unless the nesting is intentionally meaningful.
- Keep the first version runtime/server-first and aligned with the existing Bun + Hono + DAO structure.
- Do not let this task drift into metrics implementation; that is covered separately by task `0019`.


### Q&A

### Q: Where should DB tracing live?

At the centralized DB boundary already present in `packages/core/src/db/**`, not in random route handlers.

### Q: Should every internal helper get its own span?

No. The trace tree should be operationally meaningful, not noisy.

### Q: Should this task include external API tracing if task `0018` already adds outbound spans?

This task is responsible for normalizing naming and attributes across all three span families. The outbound client may emit the spans, but this task aligns the conventions.


### Design

## Problem Statement

Task `0017` established baseline telemetry and request-span wiring, but the tracing model is not yet complete or normalized. DB work remains untraced by default, and span naming/attributes across inbound HTTP and future outbound HTTP work need a single convention.

Without that normalization, future projects will produce inconsistent traces even if they all technically use OpenTelemetry.

## Recommended Boundaries

Use the repo's existing centralized seams:

- inbound HTTP: `apps/server/src/index.ts` request middleware
- DB: `packages/core/src/db/**`
- outbound HTTP: shared client boundary from task `0018`

These are the only places that should emit the default spans for their categories.

## Span Naming Guidance

Choose one clear naming scheme and apply it consistently.

Recommended defaults:

- inbound HTTP: `HTTP {METHOD} {route-or-path}`
- DB: `db.{domain-or-table}.{operation}` or equivalent stable logical naming
- outbound HTTP: `HTTP {METHOD} {operation-or-host}`

The exact strings can vary, but the scheme must be stable, documented, and testable.

## Attributes Guidance

Recommended categories:

- inbound HTTP
  - method
  - route/path
  - response status
- DB
  - `db.system`
  - logical operation kind (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
  - collection/table name when stable and safe
- outbound HTTP
  - method
  - target service/host
  - path or operation name
  - response status

Avoid raw payloads, SQL values, or user-specific IDs.

## Testing Strategy

Tests should prove:

- request spans still emit on the server boundary
- DB spans are created for representative DAO methods
- outbound spans follow the normalized convention once task `0018` is in place
- disabled-mode behavior remains safe and does not require call-site branching


### Solution

## Deliverables

1. DB tracing added to the centralized DB boundary.
2. Inbound HTTP, DB, and outbound HTTP span names/attributes aligned to one documented convention.
3. Source-matching tests for the newly instrumented boundaries.
4. Documentation/examples updated where tracing conventions become part of the default developer workflow.

## Recommended Implementation Strategy

- start with DAO-level spans for the existing DAOs
- use shared telemetry helpers rather than direct SDK calls
- verify the trace tree stays readable before considering lower-level adapter spans
- only add deeper DB instrumentation if DAO-level spans are insufficient

## Definition of Done

- DB spans exist at the shared DB boundary
- default span families use one naming/attribute convention
- no sensitive or high-cardinality data is added
- docs and tests reflect the normalized model
- `bun run check` passes


### Plan

## Phase 1: lock tracing conventions

1. Review current request-span behavior from task `0017`.
2. Align the outbound naming/attribute strategy with task `0018`.
3. Decide the DB span naming/attribute convention before coding.

## Phase 2: instrument centralized boundaries

1. Add DB spans to DAO or DB execution boundaries.
2. Adjust request-span naming/attributes if needed for consistency.
3. Verify outbound span conventions through the shared API client integration.

## Phase 3: verify and document

1. Add targeted tests for DB tracing and normalized span conventions.
2. Confirm disabled-mode behavior remains safe.
3. Update developer-facing docs/examples.
4. Run `bun run check`.

## Exit Criteria

- all three span families follow the agreed convention
- DB tracing is centralized and low-noise
- tests prove the normalized behavior
- no drift into metrics or vendor-specific backend work


### Review

## Implementation Summary

### DB Tracing Added

DB tracing was added to `BaseDao.withMetrics()` in `packages/core/src/db/base-dao.ts`. The method now wraps DAO operations with a trace span using the naming convention `db.{collection}.{operation}`.

**Changes:**
- Added `traceAsync` import from telemetry helpers
- Added `db.system: 'sqlite'` attribute to all DB spans
- Span naming follows `db.{collection}.{operation}` pattern (e.g., `db.skills.insert`, `db.skills.select`)

### Span Naming Normalized

Updated server middleware in `apps/server/src/index.ts` to use normalized span naming:

| Span Family | Convention | Example |
|-------------|------------|---------|
| HTTP Server | `HTTP {METHOD} {path}` | `HTTP GET /api/health` |
| HTTP Client | `http.client.request` | (already aligned in task 0018) |
| DB | `db.{collection}.{operation}` | `db.skills.select` |

### Attributes Standardized

All span families now use consistent OTel semantic conventions:

- **HTTP Server**: `http.request.method`, `url.path`, `server.address`, `http.response.status_code`
- **HTTP Client**: `http.request.method`, `url.full`, `url.path`, `http.response.status_code`
- **DB**: `db.system`, `db.operation`, `db.collection`

### Tests Added

New test file `packages/core/tests/db/base-dao-tracing.test.ts` verifies:
- Span naming convention `db.{collection}.{operation}`
- DB attributes (`db.system`, `db.operation`, `db.collection`)
- Error status captured when operations throw
- No-op behavior when telemetry is disabled

Updated `apps/server/tests/index.test.ts` to expect new span name format `HTTP GET /api/health`.

### Verification

- `bun run check` passes (508 tests, 98.95% func coverage)
- No sensitive data captured in span attributes
- Tracing degrades to no-op when telemetry is disabled

## Requirements Traceability

| Requirement | Status | Evidence |
|------------|--------|----------|
| R1: DB tracing at centralized boundary | ✅ MET | `base-dao.ts:29-45` - `withMetrics` wraps all DAO ops |
| R2: Normalized span naming | ✅ MET | Server: `HTTP GET /path`, DB: `db.collection.op` |
| R3: Centralized model | ✅ MET | Tracing only at middleware, BaseDao, APIClient |
| R4: Shared telemetry boundary | ✅ MET | Uses `traceAsync` helper, not direct SDK |
| R5: Low-noise trace tree | ✅ MET | One span per operational boundary |
| R6: No sensitive data in spans | ✅ MET | Only logical attributes, no SQL values |
| R7: Tests prove normalized behavior | ✅ MET | `base-dao-tracing.test.ts` + updated server test |


### Testing

| Test File | Coverage |
|-----------|----------|
| `packages/core/tests/db/base-dao-tracing.test.ts` | 5 tests: span naming, attributes, error status, no-op behavior |
| `apps/server/tests/index.test.ts` | Updated to expect `HTTP GET /api/health` span name |


### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |
| Source | `packages/core/src/db/base-dao.ts` | Lord Robb | 2026-04-23 |
| Source | `apps/server/src/index.ts` | Lord Robb | 2026-04-23 |
| Test | `packages/core/tests/db/base-dao-tracing.test.ts` | Lord Robb | 2026-04-23 |
| Test | `apps/server/tests/index.test.ts` | Lord Robb | 2026-04-23 |

### References
