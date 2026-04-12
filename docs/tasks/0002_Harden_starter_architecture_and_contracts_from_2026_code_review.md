---
name: Harden starter architecture and contracts from 2026 code review
description: Harden starter architecture and contracts from 2026 code review
status: Done
created_at: 2026-04-11T23:47:10.601Z
updated_at: 2026-04-12T02:52:38.175Z
folder: docs/tasks
type: task
priority: "high"
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---

## 0002. Harden starter architecture and contracts from 2026 code review

### Background

Follow-up task to implement the review findings from the April 11, 2026 architecture/code audit. The goal is to turn the current Bun example into a stronger modern starter by fixing contract bugs, removing architecture drift, and tightening defaults without introducing unnecessary framework complexity.


### Requirements

- Fix all identified P2/P3 findings from the review before adding new starter features.
- Preserve the project's simplicity-first philosophy: improve reuse, safety, and correctness without adding heavy abstractions.
- Keep Bun + TypeScript + Hono + Drizzle as the base stack unless a change is strictly justified by a concrete defect.
- Update docs and tests so implementation, examples, and contracts stay aligned.
- Leave room for later optional enhancements, but only ship low-complexity defaults in this task.


### Q&A

## Key Decisions

### Why treat this as one follow-up task instead of many tiny tasks?
Because the current findings are tightly connected. Validation, error semantics, logging contracts, and runtime wiring all cross the same boundaries. Splitting too early would create coordination overhead and encourage partial fixes.

### What is the standard for change selection?
Only fix issues that materially improve starter correctness, honesty, reuse, or maintainability. Do not introduce patterns whose main value is architectural elegance.

### What does “2026 modern starter” mean here?
Not chasing every new tool. It means using current low-friction best practices where they clearly improve the starter: reproducible dependency policy, typed API contracts, safe transport defaults, and clear runtime seams.

### What should be preserved?
- Bun-first developer experience.
- Simple monorepo layout.
- Thin CLI and API layers.
- High test rigor and coverage gate.
- The existing example-domain approach.


### Design

## Objective

Turn the current repository from a strong Bun example into a stronger reusable starter by tightening architecture boundaries, making contracts honest, and aligning runtime behavior with the documented promises.

## Design Principles

1. Core owns domain rules.
   Validation and typed error semantics must live in `packages/core`, not be split across CLI and API handlers.

2. Entry points own runtime wiring.
   CLI and server entry points should choose adapters, logging sinks, and environment-driven behavior explicitly. Core should not silently lock callers into Bun-specific defaults when the repository claims multi-runtime support.

3. Transport layers stay thin.
   CLI commands and HTTP handlers should translate inputs and outputs, not duplicate business rules or invent status semantics.

4. Simplicity over framework theater.
   Prefer small, direct fixes over introducing repositories, DI containers, command buses, or generic platform layers.

5. Documentation must describe reality.
   If a feature is documented as supported, it must work. If it is optional or future-facing, document it as such.

## Target End State

- JSON mode is safe for machine consumption with no log pollution on stdout.
- Validation rules are enforced consistently across CLI, service, and API paths.
- Domain failures are typed enough to map correctly to CLI exit codes and HTTP statuses.
- Default runtime wiring is explicit and does not undermine the D1 / multi-runtime story.
- Docs, config, and examples match implementation.
- The starter remains minimal, with optional 2026 upgrades clearly separated from required fixes.


### Solution

## Mandatory Fix Workstreams

### 1. Runtime wiring and adapter honesty

Problem:
- The default service path resolves to Bun SQLite through `packages/core/src/db/client.ts`, which weakens the advertised D1 / multi-runtime architecture.

Implementation intent:
- Refactor default DB access so entry points choose the adapter explicitly.
- Keep a low-friction local Bun path for CLI and local server use.
- Ensure the server factory can be instantiated with a provided DB or adapter without falling back to Bun implicitly.
- Decide whether `packages/core/src/db/client.ts` remains as Bun-only convenience or is replaced by a clearer API such as `createLocalDb()` / `createDefaultBunAdapter()`.

Acceptance criteria:
- Multi-runtime claims in docs match actual wiring.
- Services can still be instantiated simply in tests and CLI code.
- No hidden Bun lock-in remains in the server default path.

### 2. JSON contract integrity for CLI agent mode

Problem:
- `--json` output is polluted by log lines emitted to stdout.

Implementation intent:
- Separate human logs from machine output.
- Ensure JSON mode emits exactly one JSON payload to stdout and nothing else.
- If logs remain enabled during CLI execution, send them to stderr or gate them behind env-driven level control.

Acceptance criteria:
- `bun run dev:cli -- skill create --name x --json` returns clean JSON on stdout.
- The compiled binary preserves the same behavior.
- Tests lock this down for all commands, not just one mutation command.

### 3. Typed domain errors and correct transport mapping

Problem:
- Services collapse all failures into plain `Error`, and API routes map by operation instead of failure type.

Implementation intent:
- Introduce a small typed error model in core, for example not-found, validation, conflict, and infrastructure/internal.
- Preserve simplicity: a lightweight discriminated union or error class family is enough.
- Update CLI and API translation layers to map typed failures consistently.
- Reserve generic 500 responses for internal failures.

Acceptance criteria:
- Not-found remains 404.
- Validation errors become 400.
- Unexpected DB/runtime failures become 500.
- Error handling is test-covered at route and service boundary level.

### 4. Single-source validation enforcement

Problem:
- The repo claims schema-driven validation, but the CLI and service path bypass the schema constraints.

Implementation intent:
- Parse create/update inputs through core-owned schemas before persistence.
- Normalize string fields where appropriate, especially `name` and optional descriptions.
- Reject whitespace-only names and values beyond documented limits.
- Avoid duplicating validation logic in every CLI command.

Acceptance criteria:
- CLI, service, and API all enforce the same rules.
- The documented 1-100 character constraint is real.
- Tests cover invalid inputs across at least service and CLI/API boundary paths.

### 5. Error exposure and security-safe defaults

Problem:
- The global error handler currently returns raw internal error messages to API clients.

Implementation intent:
- Keep detailed logging internally.
- Return sanitized 5xx payloads externally.
- Review API auth behavior so documentation, middleware behavior, and examples align exactly.

Acceptance criteria:
- Internal exceptions do not leak implementation details in 500 responses.
- Auth behavior is documented accurately.
- If query-param auth is supported, implement it and test it; otherwise remove it from docs.

### 6. Docs and config drift cleanup

Problem:
- README, developer spec, user manual, and task docs contain behavior claims and examples that do not fully match implementation.

Implementation intent:
- Update starter docs to reflect the post-fix architecture and contracts.
- Remove typos and outdated claims.
- Make the multi-runtime story honest and bounded.
- Clarify what is first-class now versus optional future extension.

Acceptance criteria:
- README quick-start commands work as described.
- Security and validation claims match actual behavior.
- No known contract drift remains between docs and implementation.

### 7. Reproducibility and starter hygiene

Problem:
- Version policy and package metadata are loose for a starter template.

Implementation intent:
- Replace unstable dependency declarations like `latest` with pinned or bounded versions.
- Review whether Bun catalogs should be used at the root for shared package versions.
- Tighten package metadata only where it materially improves starter reuse.

Acceptance criteria:
- Dependency versioning is intentional and reproducible.
- Shared dependency versions are centralized if the complexity stays low.
- No unnecessary package-publishing complexity is introduced in this task.

## Low-Complexity 2026 Enhancements To Evaluate In This Task

These are worthwhile only if they fit naturally after the mandatory fixes:

1. Bun catalogs for shared dependency version management.
2. Exporting Hono `AppType` to enable typed RPC/client reuse later.
3. Adding low-cost HTTP middleware defaults such as request ID and secure headers.
4. Adding an explicit observability hook point so OpenTelemetry can be introduced cleanly later without refactoring the app boot flow.

## Explicitly Out Of Scope For This Task

- Full web tier implementation.
- Heavy observability rollout.
- Repository / service / controller over-abstraction.
- DI containers, plugin systems, or frameworkized domain abstractions.
- Production deployment targets like Docker, Wrangler, or cloud templates.
- Large-scale reorganization into many packages.


### Plan

## Proposed Execution Order

### Phase 1: Contract and boundary fixes
- Fix CLI logging vs JSON output.
- Introduce core validation enforcement for create/update flows.
- Add typed failure semantics and correct HTTP status mapping.

### Phase 2: Runtime wiring cleanup
- Refactor DB adapter selection so entry points own the default runtime behavior.
- Update tests to cover explicit adapter construction and non-Bun assumptions.

### Phase 3: Documentation and starter hygiene
- Update README, developer spec, user manual, and any task/spec references affected by the fixes.
- Clean dependency version policy and centralization where justified.

### Phase 4: Small 2026-ready upgrades
- Evaluate Bun catalogs.
- Export Hono `AppType` if it improves future client reuse with low cost.
- Add request-id / secure-headers only if they remain unobtrusive and testable.

## Definition of Done

- `bun run check` passes.
- CLI JSON mode is clean and test-covered.
- Validation and error semantics are consistent across core, CLI, and API.
- Docs match runtime behavior.
- The starter remains small and understandable.


### Review

## Source Audit Summary

This task is derived from the April 11, 2026 comprehensive code review of the current codebase, with emphasis on architecture, design quality, starter honesty, and 2026-fit best practices.

Primary issue groups captured by the review:
- Runtime wiring does not fully support the advertised multi-runtime story.
- CLI `--json` mode is not machine-safe because logs contaminate stdout.
- Validation is fragmented and not enforced as a real single source of truth.
- Service and route error semantics are too weak to support correct transport mapping.
- API 5xx handling exposes too much internal detail.
- Docs and config contain implementation drift.
- Dependency/version policy is looser than ideal for a starter template.

The implementation phase for this task should treat the review findings as the baseline defect list, and it should close them with tests rather than only adjusting documentation.


### Testing

## Required Test Coverage

### Core
- Service rejects invalid create/update inputs using the same rules documented for the API.
- Service returns typed failures for not-found and internal error conditions.
- Adapter wiring remains injectable and testable without relying on global singleton state.

### CLI
- Every `--json` command produces parseable JSON with no preamble/noise.
- Invalid inputs return error JSON consistently.
- Human mode still writes user-facing messages correctly.

### API
- Validation failures return 400 with stable error envelopes.
- Not-found returns 404.
- Unexpected service/infrastructure failures return sanitized 500 payloads.
- Auth behavior matches the documented contract exactly.

### Regression / Starter Integrity
- README smoke commands remain valid.
- Binary build still works after the refactor.
- Coverage gate remains green without adding broad whitelist exemptions.


### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |
| New file | `packages/core/src/errors.ts` | Lord Robb | 2026-04-11 |
| New file | `packages/core/src/config.ts` | Lord Robb | 2026-04-11 |
| New file | `packages/core/tests/errors.test.ts` | Lord Robb | 2026-04-11 |
| New file | `packages/core/tests/config.test.ts` | Lord Robb | 2026-04-11 |
| New file | `apps/cli/src/config.ts` | Lord Robb | 2026-04-11 |
| New file | `apps/server/src/config.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/services/skill-service.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/db/client.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/db/adapters/bun-sqlite.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/schemas/skill.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/index.ts` | Lord Robb | 2026-04-11 |
| Modified | `packages/core/src/types/result.ts` | Lord Robb | 2026-04-11 |
| Modified | `apps/server/src/index.ts` | Lord Robb | 2026-04-11 |
| Modified | `apps/server/src/routes/skills.ts` | Lord Robb | 2026-04-11 |
| Modified | `apps/server/src/middleware/error.ts` | Lord Robb | 2026-04-11 |
| Modified | `apps/cli/src/index.ts` | Lord Robb | 2026-04-11 |
| Modified | `package.json` | Lord Robb | 2026-04-11 |
| Modified | `drizzle.config.ts` | Lord Robb | 2026-04-11 |
| Updated | `docs/01_ARCHITECTURE_SPEC.md` | Lord Robb | 2026-04-11 |
| Updated | `docs/02_DEVELOPER_SPEC.md` | Lord Robb | 2026-04-11 |
| Updated | `docs/03_USER_MANUAL.md` | Lord Robb | 2026-04-11 |

### References

## Local References
- `README.md`
- `docs/01_ARCHITECTURE_SPEC.md`
- `docs/02_DEVELOPER_SPEC.md`
- `docs/03_USER_MANUAL.md`
- `packages/core/src/db/client.ts`
- `packages/core/src/services/skill-service.ts`
- `packages/core/src/schemas/skill.ts`
- `apps/cli/src/index.ts`
- `apps/cli/src/commands/skill-*.ts`
- `apps/server/src/index.ts`
- `apps/server/src/routes/skills.ts`
- `apps/server/src/middleware/auth.ts`
- `apps/server/src/middleware/error.ts`
- `scripts/check-coverage.ts`

## External Best-Practice References
- Bun workspaces and catalogs: https://bun.sh/docs/pm/workspaces
- Hono RPC / exported app typing: https://hono.dev/docs/guides/rpc
- Hono middleware catalog, including request-id and secure-headers: https://hono.dev/docs
- TypeScript project references: https://www.typescriptlang.org/docs/handbook/project-references.html
- OpenTelemetry JS bootstrap guidance: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/

## Notes
- TypeScript project references and OpenTelemetry are guidance references, not mandatory implementation targets for this task.
- Favor the smallest change that makes the starter more honest, more reusable, and easier to evolve.

