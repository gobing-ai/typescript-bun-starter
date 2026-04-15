---
name: Formalize shared contracts and common library boundaries
description: Formalize shared contracts and common library boundaries
status: Done
created_at: 2026-04-15T20:27:32.880Z
updated_at: 2026-04-15T22:08:58.989Z
folder: docs/tasks
type: task
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---

## 0005. Formalize shared contracts and common library boundaries

### Background

The starter has reached the point where `packages/core` is doing too much. It currently carries domain services, persistence concerns, validation schemas, logger exports, error primitives, and some transport-adjacent contracts. That has already created three kinds of friction:

1. Cross-tier contracts are not clearly separated from domain/runtime code.
2. Transport layers repeat response/error handling concerns instead of sharing them.
3. Import ergonomics and workspace boundaries get harder to maintain as new shared modules appear.

A direct import-resolution fix has now been added for `@starter/contracts` and `@starter/core`, including bootstrap-safe package renaming support. That unblocks immediate work, but it does not by itself define how shared libraries should be organized going forward.

This task is to design and implement the durable shared-library architecture for the starter so future features do not collapse back into `packages/core` as an unstructured common bucket.


### Requirements

### Objectives

1. Establish clear ownership boundaries for shared code across the starter.
2. Keep transport-safe contracts reusable by CLI, server, and web without dragging in DB/runtime concerns.
3. Preserve the repo's bootstrap behavior so scope changes continue to rewrite package imports safely.
4. Make TypeScript/Bun import ergonomics reliable for local development, tests, and future workspaces.
5. Avoid introducing a generic `utils` dump with no architectural ownership.

### Functional Requirements

1. `packages/contracts` must remain transport-safe and runtime-light.
2. `packages/core` must remain the domain + persistence layer and may depend on `packages/contracts` where appropriate.
3. Future shared libraries must have an explicit reason to exist and a dependency direction that can be enforced.
4. Shared request/response contracts, API envelopes, and DTOs must move out of app-local code when they are cross-tier.
5. Error translation rules should be shared instead of reimplemented independently in CLI/server/web.
6. Config/env parsing primitives should be shared only if they encode policy, not as a miscellaneous helper bucket.
7. The repo contract, generated instructions, and bootstrap script must stay aligned with any new shared workspaces.

### Non-Goals

- Do not migrate every existing module in one pass.
- Do not introduce framework-specific helper packages unless there is proven repeated need.
- Do not allow app-to-app imports.


### Q&A



### Design

## Design Overview

The shared-library model now has two committed layers:

- `packages/contracts`
  Owns transport-safe cross-tier contracts, API envelopes, error/status mapping helpers, and DTO-style shared types/schemas.
- `packages/core`
  Owns domain services, persistence adapters, DB schemas, and domain validation.

## Dependency Direction

- `@starter/contracts` has no internal workspace dependencies.
- `@starter/core` may depend on `@starter/contracts`.
- `apps/cli`, `apps/server`, and `apps/web` may depend on `@starter/contracts` and `@starter/core`.
- App workspaces must not import other app workspaces.

## Implementation Shape

- Transport-layer error mapping was centralized behind shared contracts.
- Web-facing API contracts moved out of app-local ad hoc types.
- The bootstrap flow and repo contract now understand both `packages/contracts` and `packages/core`, so scope rewrites remain stable.
- The web client keeps the default bundle runtime-light, with schema validation moved into an opt-in validator module.

## Intentional Non-Goals

- No generic `utils` or `common` package was introduced.
- No additional shared package such as `platform` or `client` was created yet.
- Historical task files were not treated as migration targets for this closure.


### Solution

## Recommended Architecture

Adopt a layered shared-library model with explicit ownership:

- `packages/contracts`
  Owns cross-tier DTOs, API envelopes, shared request/response contracts, and transport-safe types/schemas.
- `packages/core`
  Owns domain services, business rules, persistence adapters, DB schemas, and domain validation.
- `packages/platform` or `packages/foundation` (future, optional)
  Owns cross-cutting primitives only when there is proven repeated need: error/status mapping, logger/config composition, clock/id abstractions, and similar policy-bearing utilities.
- `packages/client` (future, optional)
  Owns typed fetch clients and client-side transport helpers if the web/API surface becomes large enough to justify it.

## Dependency Direction

Use and enforce this direction:

- `contracts` -> no internal workspace dependencies
- `core` -> may depend on `contracts`
- `cli/server/web` -> may depend on `contracts` and `core`
- `app` workspaces -> must never depend on other app workspaces
- future `platform` -> must not become a dumping ground; it needs explicit acceptance criteria before creation

## What Should Move First

### Phase 1: Contracts extraction

Move these first because they already leak across tiers:

- API envelopes such as `ApiResponse<T>` and shared error payloads
- health/status DTOs
- route-safe request/response payload contracts that are consumed by more than one tier
- any future shared Zod schemas that are transport-level rather than domain-level

### Phase 2: Error translation

Create shared error mapping primitives, for example:

- domain error code -> HTTP status
- domain error code -> CLI exit code
- domain error -> transport-safe error body

This reduces duplication currently visible between route handlers and middleware.

### Phase 3: Config and client composition

Only after repeated need is visible:

- extract policy-bearing config/env readers
- extract typed web/API client helpers if the current thin client grows

## Guardrails

1. No `utils.ts`, `shared.ts`, or `common.ts` buckets.
2. New shared package proposals must define:
   - ownership
   - allowed dependents
   - forbidden dependencies
   - concrete modules that move into it
3. If a module mixes transport and domain concerns, split the contract from the implementation.
4. Barrel exports are required for public package surfaces.
5. Bootstrap compatibility is mandatory for any new package alias.

## Migration Strategy

1. Keep the current import-resolution fix as the foundation.
2. Incrementally move app-local shared contracts into `packages/contracts`.
3. Replace duplicated error/status mapping with shared mappers.
4. Update canonical docs after each package-level architectural change.
5. Only create additional shared packages when at least two real consumers exist or one package is already mixing incompatible concerns.

## Risks

- Over-splitting too early creates ceremony without value.
- Under-splitting leaves `packages/core` as a junk drawer.
- Moving Zod schemas blindly can mix transport validation with domain invariants.
- Adding path aliases without bootstrap/contract alignment will regress after rescoping.

## Recommendation

Treat `packages/contracts` and `packages/core` as the only committed shared packages for now. Defer `platform` and `client` until concrete duplication exists. That keeps the starter opinionated but not over-engineered.


### Plan

## Implementation Plan

### Phase A: Stabilize the current contracts layer

- [x] Expand `packages/contracts` beyond minimal DTOs to include the shared API envelope/error payload contract surface.
- [x] Decide whether contracts should use plain TypeScript types only, plain `zod`, or a dual model (`zod` + inferred types).
- [x] Document what qualifies as a transport-safe contract.

**Decision**: Use TypeScript types only in contracts (runtime-light). Zod schemas stay in domain packages.

### Phase B: Reduce duplication already visible today

- [x] Extract shared error/status mapping helpers from the server route/middleware duplication.
- [x] Decide whether CLI should consume shared formatters/mappers or keep presentation fully local.
- [x] Move cross-tier health/api response contracts out of app-local modules.

**Decision**: CLI keeps error presentation local (no shared formatters needed yet). `errorCodeToHttpStatus()` centralized in contracts.

### Phase C: Tighten package boundaries

- [x] Update the architecture spec to show `packages/contracts` and its allowed dependencies.
- [x] Add or refine contract checks if new packages are introduced.
- [x] Verify bootstrap continues rewriting all scoped imports after `bun run bootstrap -- --scope ...`.

**Verification**: `bun run bootstrap -- --name demo --scope @acme --dry-run` shows 41 files would be rewritten correctly.

### Phase D: Decide on future shared packages deliberately

- [x] Evaluate whether `packages/platform` is justified by real duplication.
- [x] Evaluate whether a dedicated `packages/client` is justified by web/API client growth.
- [x] Reject any package proposal that is only a renamed miscellaneous helper bucket.

**Status**: Deferred. Current architecture (`contracts` + `core`) is sufficient. No immediate need for `platform` or `client`.

**Additional completion notes**:
- Added Zod schemas to contracts (`ErrorResponseSchema`, `HealthResponseSchema`) for dual-model support
- Web API client now uses shared schemas for validation
- Created helper functions (`createErrorResponse`, `validateHealthResponse`, `createApiError`)
- Bootstrap verified working with 42+ files correctly scoped
- Task status: Completed

### Review

**Completed fixes**:
- Replaced `appErrorStatus()` string comparison with `errorCodeToHttpStatus()` from `@starter/contracts`
- Server routes now use type-safe `ErrorCode` enum
- Route definitions include 409 Conflict responses for completeness
- Architecture spec updated with dependency diagram



### Testing

## Acceptance Criteria

- [x] Shared transport contracts live in `packages/contracts`, not ad hoc in app-local files.
- [x] `packages/core` remains domain/persistence focused and does not absorb unrelated transport helpers.
- [x] Bootstrap continues to rewrite package scopes correctly for all shared packages.
- [x] `bun run check` passes after each migration step.
- [x] Documentation and generated instructions stay aligned with actual workspace boundaries.

## Verification Checklist

- [x] `bun run bootstrap -- --name demo --scope @acme --dry-run` shows shared package names rewritten correctly.
- [x] `bun run check` passes.
- [x] Web/API/CLI consumers import shared contracts without relative cross-package paths.
- [x] No app workspace imports another app workspace.


### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |
| Code | `packages/contracts/src/index.ts` | Lord Robb | 2026-04-16 |
| Code | `packages/core/src/errors.ts` | Lord Robb | 2026-04-16 |
| Code | `apps/server/src/routes/skills.ts` | Lord Robb | 2026-04-16 |
| Code | `apps/web/src/lib/api-client.ts` | Lord Robb | 2026-04-16 |
| Test | `packages/contracts/tests/contracts.test.ts` | Lord Robb | 2026-04-16 |
| Test | `apps/web/tests/api-client.test.ts` | Lord Robb | 2026-04-16 |
| Docs | `docs/01_ARCHITECTURE_SPEC.md` | Lord Robb | 2026-04-16 |
| Docs | `docs/tasks/0005_...md` | Lord Robb | 2026-04-16 |### References

- `contracts/project-contracts.json`
- `scripts/bootstrap-project.ts`
- `scripts/check-contracts.ts`
- `packages/contracts/`
- `packages/core/`
- `apps/server/src/routes/skills.ts`
- `apps/server/src/middleware/error.ts`
- `apps/web/src/lib/api-client.ts`

