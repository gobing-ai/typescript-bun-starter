---
name: Fix pipeline dogfooding findings from task 0002 retrospective
description: Fix project-specific findings from task 0002 retrospective (orchestration findings moved to cc-agents)
status: Done
created_at: 2026-04-12T01:10:46.389Z
updated_at: 2026-04-12T02:57:22.835Z
folder: docs/tasks
type: task
priority: "high"
preset: "standard"
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---

## 0003. Fix pipeline dogfooding findings from task 0002 retrospective

### Background

Task 0002 (Harden starter architecture and contracts) was executed through the rd3 standard pipeline. The implementation delivered correct results — 85 tests pass, coverage gate green, all workstreams implemented. A systematic retrospective identified issues across two domains:

- **Orchestration/workflow issues** (C1, M1-M4, L3) — moved to `cc-agents` project where the pipeline tooling lives.
- **Project-specific findings** — this task. All resolved below.

### Scope

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| C2 | Coverage threshold mismatch between pipeline.yaml and check-coverage.ts | CRITICAL | ✅ Fixed |
| H1 | Arch spec §6.1 has stale getConsoleSink() example | HIGH | ✅ Fixed |
| H2 | User manual has duplicate auth row | HIGH | ✅ Fixed |
| H3 | Task 0001 still documents api_key query param | HIGH | ✅ Fixed |
| H4 | Task 0002 status never transitioned from Backlog | HIGH | ✅ Fixed |
| H5 | CLI/server config files have no coverage tracking | HIGH | ✅ Fixed |
| M5 | Task 0002 "2026 Enhancements" were never evaluated | MEDIUM | ✅ Evaluated |
| M6 | client.ts uses require() but says "dynamic import" | MEDIUM | ✅ Fixed |
| L1 | NO_TEST_REQUIRED comments are stale | LOW | ✅ Fixed |
| L2 | drizzle-kit pin is loose | LOW | ✅ Fixed |
| L4 | Developer spec may have residual old patterns | LOW | ✅ Verified clean |

### Requirements

1. Fix all findings that affect correctness, reliability, or consistency.
2. Evaluate the unevaluated 2026 enhancements from task 0002.
3. Update all documentation to be internally consistent and match implementation.
4. `bun run check` must pass after every fix.

### Q&A

#### Why a separate task instead of fixing inline?
The findings span documentation, config, and code. Mixing them into task 0002 would blur its completion boundary. A clean retrospective task keeps the audit trail clear.

#### Where did the orchestration findings go?
C1 (Pipeline FSM never written to), M1 (ad-hoc BDD), M2 (self-review), M3 (TDD not followed), M4 (worktree unused), and L3 (impl_progress never updated) were copied to the `cc-agents` project for fixing at the pipeline tooling layer.

### Design

## Findings and Resolutions

### 🔴 C2. Coverage threshold mismatch — ✅ Fixed

**What happened**: `pipeline.yaml` declared `coverage_threshold: 80` for standard/complex presets, but `scripts/check-coverage.ts` hardcodes `THRESHOLD = 90`. The pipeline's declared config was ignored by the actual gate.

**Resolution**: Updated `pipeline.yaml` standard and complex presets to `coverage_threshold: 90`, matching the real gate. The `check-coverage.ts` hardcoded value remains the single source of truth.

**Files**: `docs/.workflows/pipeline.yaml`

---

### 🟠 H1. Arch spec §6.1 stale getConsoleSink() example — ✅ Fixed

**What happened**: The logging example showed `sinks: { console: getConsoleSink() }` as the canonical setup. Actual code now uses `getStreamSink(Writable.toWeb(process.stderr))` for the server and conditionally for CLI.

**Resolution**: Replaced §6.1 example with the current dual-sink pattern — server always uses stderr stream, CLI conditionally switches between console and stderr based on `--json` mode.

**Files**: `docs/01_ARCHITECTURE_SPEC.md`

---

### 🟠 H2. User manual duplicate auth row — ✅ Fixed

**What happened**: Lines 285-286 both described `X-API-Key` header auth. The old `api_key` query param row was replaced but the original wasn't removed.

**Resolution**: Removed the duplicate row. One clean row remains.

**Files**: `docs/03_USER_MANUAL.md`

---

### 🟠 H3. Task 0001 stale api_key reference — ✅ Fixed

**What happened**: Task 0001 reference table still said "Checks `X-API-Key` header or `api_key` query param." The middleware no longer supports query param auth.

**Resolution**: Updated to reflect header-only auth with timing-safe comparison.

**Files**: `docs/tasks/0001-implement-agent-skill-engine.md`

---

### 🟠 H4. Task 0002 never closed — ✅ Fixed

**What happened**: Task 0002 frontmatter was `status: Backlog`, all `impl_progress` fields `pending`, Artifacts table empty.

**Resolution**: Status → `Done`, all impl_progress → `done`, Artifacts filled with 21 entries covering all new/modified files.

**Files**: `docs/tasks/0002_Harden_starter_architecture_and_contracts_from_2026_code_review.md`

---

### 🟠 H5. CLI/server config files untracked in coverage — ✅ Fixed

**What happened**: `apps/cli/src/config.ts` and `apps/server/src/config.ts` are pure `as const` constants with 0 instrumented lines. The coverage gate silently skipped them with no documented exemption.

**Resolution**: Added both to `NO_TEST_REQUIRED` in `check-coverage.ts` with comments explaining they're pure constants. Also updated the stale `client.ts` comment (was "convenience export (2 lines)", now "lazy singleton adapter (Bun-only convenience)").

**Files**: `scripts/check-coverage.ts`

---

### 🟡 M5. 2026 Enhancements unevaluated — ✅ Evaluated

**What happened**: Task 0002 listed 4 enhancement items to evaluate. None were assessed.

**Resolution**: Each item evaluated with explicit decision:

| # | Enhancement | Decision | Rationale |
|---|------------|----------|-----------|
| 1 | Bun catalogs for shared dependency versions | **DEFER** | Only 2 packages share dependencies. Bun catalogs add a `bunfig.toml` entry for marginal DRY benefit. Revisit if monorepo grows beyond 3 packages. |
| 2 | Export Hono `AppType` for typed RPC/client reuse | **ACCEPT → Implemented** | One-line export (`export type AppType = typeof app`) with zero cost. Enables future typed clients via `hono/client`. Low effort, high leverage. |
| 3 | Request-id + secure-headers middleware | **DEFER** | Hono provides `secureHeaders()` and `requestId()` middleware, but this starter has no production deployment target yet. Add when first deployment target is configured. |
| 4 | OTel observability hook point | **REJECT** | Premature. Adding a hook point for an unused library creates maintenance surface without value. OTel can be introduced cleanly when needed — LogTape already provides structured logging as interim observability. |

**Files**: `apps/server/src/index.ts` (AppType export added)

---

### 🟡 M6. client.ts require/import mismatch — ✅ Fixed

**What happened**: `packages/core/src/db/client.ts` used `require()` with a comment saying "dynamic import". `require()` is synchronous CommonJS, not dynamic ESM import.

**Resolution**: Updated comment to accurately describe the rationale — synchronous `require()` keeps `getDefaultAdapter()` non-async, avoiding an async cascade through all callers (CLI commands, test setup).

**Files**: `packages/core/src/db/client.ts`

---

### 🔵 L1. NO_TEST_REQUIRED comments stale — ✅ Fixed

**Resolution**: Fixed as part of H5. `client.ts` entry updated from "convenience export (2 lines)" to "lazy singleton adapter (Bun-only convenience)".

**Files**: `scripts/check-coverage.ts`

---

### 🔵 L2. drizzle-kit pin loose — ✅ Fixed

**What happened**: Pinned to `^0.30.0` but installed version is `0.31.x`.

**Resolution**: Tightened to `^0.31.0`.

**Files**: `package.json`

---

### 🔵 L4. Developer spec residual old patterns — ✅ Verified clean

**What happened**: Concern that dev spec might still reference old import patterns.

**Resolution**: Full scan confirmed all references already use the current `getDb()` API. No changes needed.

---

### Solution

All 11 project-specific findings resolved in a single batch. No orchestration findings remain in this task.

### Plan

Executed as a single batch since all items were small, isolated fixes.

### Review

## Source Audit

Findings identified by comparing:
1. Pipeline YAML config vs actual execution
2. Documentation (arch spec, dev spec, user manual, task files) vs implementation
3. Task 0002 acceptance criteria vs delivered artifacts
4. Coverage gate config vs pipeline threshold declarations

### Testing

## Verification

- `bun run check`: 85 pass, 0 fail, coverage gate green
- `rg` scan for stale patterns: no residual `api_key`, `defaultDb`, or stale `getConsoleSink()` references remain
- Task 0002 properly closed via `tasks update 0002 Done`

### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |
| Modified | `docs/.workflows/pipeline.yaml` | Lord Robb | 2026-04-12 |
| Modified | `docs/01_ARCHITECTURE_SPEC.md` | Lord Robb | 2026-04-12 |
| Modified | `docs/03_USER_MANUAL.md` | Lord Robb | 2026-04-12 |
| Modified | `docs/02_DEVELOPER_SPEC.md` | Lord Robb | 2026-04-12 |
| Modified | `docs/tasks/0001-implement-agent-skill-engine.md` | Lord Robb | 2026-04-12 |
| Modified | `docs/tasks/0002_Harden_starter_...md` | Lord Robb | 2026-04-12 |
| Modified | `scripts/check-coverage.ts` | Lord Robb | 2026-04-12 |
| Modified | `packages/core/src/db/client.ts` | Lord Robb | 2026-04-12 |
| Modified | `apps/server/src/index.ts` (AppType export) | Lord Robb | 2026-04-12 |
| Modified | `package.json` (drizzle-kit pin) | Lord Robb | 2026-04-12 |

### References

- `docs/tasks/0002_Harden_starter_architecture_and_contracts_from_2026_code_review.md` — source task
- `scripts/check-coverage.ts` — coverage gate config
- `docs/.workflows/pipeline.yaml` — pipeline phase config
