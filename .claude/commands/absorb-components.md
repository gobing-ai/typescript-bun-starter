---
description: Absorb and generalize reusable components from a source project
argument-hint: <source-project-path> [--desc <freeform description>]
allowed-tools: Read, Write, Edit, Bash(bun:*), Bash(rg:*), Bash(sg:*), Bash(git:*)
---

Extract reusable components from an existing project into this starter. The reverse of `/apply-migration`.

Discovers candidates through scoring, not rigid categories. The agent scans broadly, scores each candidate on three independent dimensions, and presents a ranked inventory for the user to pick from.

## Usage

```
/absorb-components <source-project-path> [--desc <freeform description>]
```

- `<source-project-path>` — path to the project to mine.
- `--desc` — freeform text describing what you're looking for. Optional. Soft steering — adjusts candidate ranking, not inclusion. Examples: `"authentication patterns"`, `"data layer utilities"`, `"rate limiting and caching"`.
  - **Default** (when omitted): *"Extract business-agnostic, reusable components with low coupling to the source project's domain. Prioritize utilities, shared types, infrastructure helpers, and well-tested libraries over domain-specific logic."*

If `<source-project-path>` is missing, ask. Do not guess.

## Principles

- **Non-destructive.** No overwrites without explicit approval. Diff first.
- **Generalize, don't xerox.** Strip caller-specific assumptions before landing.
- **Match the contract.** Comply with `CLAUDE.md`, `AGENTS.md`, `contracts/project-contracts.json`, nested `AGENTS.md`. No `__tests__/`, tests in `tests/` mirroring `src/`, no `biome-ignore noExplicitAny` (sole exception: `noUselessConstructor` for V8 coverage), no `console.*`, public exports via `src/index.ts`.
- **Tests are mandatory.** Port them, or write them. No untested absorb.
- **Stop at phase boundaries.** Wait for explicit "yes" before proceeding.

## Scoring Framework

Every candidate is scored on three independent dimensions. **No composite score.** Each dimension stands on its own so the user sees the full profile and decides based on their priorities.

### Dimensions

| Dimension | 1 (Low) | 3 (Mid) | 5 (High) |
|---|---|---|---|
| **Maturity** | No tests, no error handling, happy-path only | Some tests, basic edge cases | Well-tested, documented, battle-tested in production |
| **Reusability** | Hardcoded to source domain, many internal deps, tightly coupled | Some coupling, extractable with moderate effort | Framework-agnostic, clean interface, few deps, zero domain assumptions |
| **Absorb Effort** | Major rewrite needed, stack incompatible, heavy dep conflicts | Moderate adaptation, known translation patterns | Near drop-in, stack match, minimal refactoring |

### Inclusion Threshold

A candidate is included if **at least one dimension scores ≥ 4**. This is intentionally generous — it surfaces candidates that are strong in any single dimension so the user can decide what matters most for their situation.

Candidates scoring ≤ 3 on all three dimensions are filtered out with a one-line reason.

### How `--desc` Influences Scoring

The description is **soft steering**, not a hard filter. It adjusts the relevance of candidates during ranking:

- `"authentication patterns"` → candidates mentioning auth, session, JWT, middleware rank higher in presentation order
- `"data layer utilities"` → ORM helpers, schema builders, migration tools surface first
- No description → default favors generic, business-agnostic components over domain-specific ones

All candidates still appear in the inventory if they pass the inclusion threshold. The description just changes the order and grouping emphasis.

## Workflow

Track each phase with `TaskCreate`/`TaskUpdate`; mark complete the moment a phase ends.

### Phase 1: Validate Inputs

1. Resolve `<source-project-path>` to absolute. Verify it exists and is a directory.
2. Parse `--desc` if provided; otherwise use the default description.
3. Read this repo's contract once: `CLAUDE.md`, `AGENTS.md`, `contracts/project-contracts.json`, plus the nested `AGENTS.md` files (under `packages/contracts`, `packages/core`, `apps/cli`, `apps/server`, `apps/web`).

### Phase 2: Tech Stack Analysis (Go / No-Go Gate)

Cheap viability check on metadata only. **Do not scan candidate components yet.**

1. **Inspect source manifests/configs:** `package.json` (or `Cargo.toml`/`go.mod`/`pyproject.toml` — if non-JS/TS, stop and confirm with user before continuing), lockfile (implies package manager), `tsconfig.json`, test config (`vitest.config.*`/`jest.config.*`/`bun.test.*`), lint/format config (`biome.json`/`.eslintrc*`/`.prettierrc*`), build config (`tsup`/`vite`/`webpack`/`rollup`/`next.config.*`/`astro.config.*`), and instruction files (`AGENTS.md`/`CLAUDE.md`/`README.md`).
2. **Build a stack profile:** runtime + version, language + module system (ESM/CJS), package manager, test runner, lint/format, relevant frameworks, license (`package.json` field + `LICENSE` file).
3. **Classify each axis** vs this repo (Bun + TS strict + Biome + `bun test`, `@starter/*` workspaces, `workspace:*` cross-deps):
   - **Match** — drop-in
   - **Adapt** — mechanical translation (Vitest → `bun test`, ESLint → Biome)
   - **Bridge** — needs an abstraction (Node-only API behind an adapter)
   - **Block** — incompatible without runtime/framework swap
4. **Verdict:**
   - **Green** — all Match/Adapt. Proceed.
   - **Yellow** — Bridge items present but salvageable. Proceed with caveats.
   - **Red** — any Block on the critical path, or license incompatible with this repo's `LICENSE`. Recommend abort.
5. **Report to user** — compact table:

   | Axis | Source | This Repo | Class | Notes |
   |---|---|---|---|---|
   | Runtime | … | Bun | … | … |
   | Test runner | … | bun test | … | … |
   | License | … | (this repo) | … | … |

   Plus: verdict, top 3–5 adaptation costs, any license/security flags, one-line recommendation.
6. **Gate.** Ask: "Proceed to candidate scan?" Wait for "yes". On Red, only continue if the user explicitly overrides.
7. **Restate plan** (2–3 sentences): "Source X. Steering: Y. Likely target tier(s) Z. Adaptation cost low/med/high because …".

### Phase 3: Scan & Score

Broad discovery followed by per-candidate scoring. No rigid categories — let the code speak.

1. **Locate candidates** with `rg` and `sg` (ast-grep). Match filenames, exports, function/class names, surrounding comments. Search synonyms — `auth middleware` also implies `guard`, `interceptor`, `requireUser`, `withSession`. For wide scans, delegate the broad discovery to the `Explore` subagent and request SECU-shaped summaries.
2. **Per-candidate review** using the `rd3:code-review-common` skill — apply its **SECU framework** (Security, Efficiency, Correctness, Usability) and **P1–P4** severity. For each candidate capture:
   - Public API (exports, inputs/outputs)
   - Internal deps (project-specific modules, config, DB)
   - External deps (npm packages with versions; flag any not in this repo)
   - Side effects (network, fs, env, globals)
   - Test coverage (existing fixtures/mocks)
   - SECU findings ranked P1–P4
3. **Score each candidate** on the three dimensions (1–5 each). Apply inclusion threshold: at least one dimension ≥ 4. Filter out candidates scoring ≤ 3 on all three.
4. **Decide target placement** per the contract:
   - DTOs/schemas → `packages/contracts/`
   - Domain logic, framework-agnostic utilities → `packages/core/`
   - CLI pieces → `apps/cli/` · server middleware/routes → `apps/server/` · UI → `apps/web/` (PascalCase in `components/` and `layouts/`)
   - When ambiguous, prefer `packages/core/`. Apps must not import from other apps.
5. **Present candidates** grouped by strongest dimension:

   ```markdown
   ## High Maturity (maturity ≥ 4)
   Candidates that are battle-tested and production-ready.

   | # | name | source_path | maturity | reusability | effort | target_path | notes |
   |---|------|-------------|----------|-------------|--------|-------------|-------|

   ## High Reusability (reusability ≥ 4)
   Candidates with clean interfaces and low coupling.

   | # | name | source_path | maturity | reusability | effort | target_path | notes |
   |---|------|-------------|----------|-------------|--------|-------------|-------|

   ## Low Effort (effort ≤ 2)
   Candidates that are near drop-in with minimal adaptation.

   | # | name | source_path | maturity | reusability | effort | target_path | notes |
   |---|------|-------------|----------|-------------|--------|-------------|-------|
   ```

   - A candidate can appear in multiple groups — that means it's strong in multiple ways.
   - Within each group, sort by the grouping dimension descending, then by target path.
   - `notes` — 1 sentence per candidate; surface every P1/P2 SECU finding explicitly.
   - After the groups, list **filtered-out candidates** with one-line reasons: "trivial — write fresh", "GPL", "PII detected", "all dimensions ≤ 3".

### Phase 4: User Selection

1. Ask which to absorb: "all recommended" / explicit list by number / "everything except X, Y".
2. For ambiguous cases, confirm: rename? keep optional features (e.g. "supports both Redis and in-memory — keep both?")? placement override?
3. Read back the final numbered plan. Wait for "yes, proceed". Do **not** modify this repo's files until then.

### Phase 5: Generalize & Absorb

Process one component at a time so the user can interrupt cleanly.

1. **Add dependencies first.** New runtime deps via `bun add`, dev deps via `bun add -d`, into the correct workspace. Pin to source's version unless there's a reason to upgrade.
2. **Stage in scratch** (e.g. `/tmp/absorb-<name>/`) so refactor doesn't touch the target tree until it compiles.
3. **Refactor for reuse:**
   - Replace caller-specific types with generics or `@starter/contracts` interfaces.
   - Lift hard-coded strings, env names, table names, feature flags into typed options with defaults.
   - Delete dead branches that only existed for the source project.
   - Swap logging for repo conventions (`logger.*` from `scripts/logger.ts` in scripts; standard logger in app code).
   - Replace project-specific error classes with local equivalents, or introduce a shared error type if multiple components need it.
   - File names kebab-case (PascalCase only in `apps/web/src/components/` and `layouts/`).
   - Strip `biome-ignore` — fix the root cause.
4. **Place** into the target workspace. Export public surface from `src/index.ts`.
5. **Port tests** to `tests/` mirroring `src/`. Convert source test runner → `bun test`. Add cases for new generalization seams (e.g. test both adapters when both are kept). If source had none, write them now — minimum: one happy path + one error/edge per public function.
6. **Cross-workspace wiring.** Consumers in this repo import via `workspace:*`. Never duplicate across workspaces.
7. **Per-component check** (optional but recommended for batches): run `bun run check` after each component lands. Catches regressions early.

### Phase 6: Verify

1. Run the DoD gate from repo root:

   ```bash
   bun run format && bun run check
   ```

2. If it fails: fix the root cause. Don't bypass with `biome-ignore`, weaken types, or delete failing tests. Re-run until green.
3. If a contract check fails (workspace boundary, naming, generated-instruction drift), fix placement or regenerate per the failure message — don't relax the contract.
4. After green: `git status` + diff review. Surface unexpected changes to the user before continuing.

### Phase 7: Report & Hand Off

1. Summary:
   - Absorbed (final names + paths)
   - Skipped + reason
   - New deps per workspace
   - Tests added (count)
   - Follow-ups (e.g. "rate limiter is in-memory only; wire Redis later")
2. Suggest a conventional commit:

   ```
   feat(core): absorb <components> from <source>

   Generalizes <summary of what was absorbed>.
   Adds <N> unit tests.
   ```

3. Do **not** commit. Per repo policy, commits are user-initiated.

## Skip List

Do not absorb components that are:

- Tightly coupled with no generalization path (refactor ≈ rewrite — write fresh instead).
- Licensed incompatibly with this repo's `LICENSE`.
- Containing secrets, credentials, customer data, or PII. **Stop and tell the user — do not copy to scratch.**
- Targeting an unsupported runtime with no abstraction worth building now.
- Trivially small (<~20 LOC, no real logic).
- Scoring ≤ 3 on all three dimensions (maturity, reusability, absorb effort).

## Excluded Source Paths

Skip when scanning: `.git/`, `node_modules/`, `dist/`, `build/`, `coverage/`, `.next/`, `.astro/`, `.turbo/`, lock files, `*.env*`, generated code (unless the generator itself is the target).

## Failure Recovery

- **`bun run check` won't go green and the fix is non-trivial.** Stop. Summarize remaining failures and offer two paths: (a) deeper refactor, or (b) drop the failing component and ship the rest. User decides.
- **Hidden coupling found mid-absorb.** Move back to scratch, re-plan with the user.
- **Source uses an unsupported runtime/framework.** Don't half-port. Skip, or escalate as a separate runtime-adoption decision.
- **User changes their mind.** Use `git status` + `git diff` to show what's written; offer to revert specific files. Never `git reset --hard` without approval.
- **Partial success acceptable.** If N components selected and only K succeed cleanly, shipping the K and dropping the rest is a valid outcome — confirm with the user.

## Notes

- All-in-one command. Single file. No splits.
- Prefer `rg` and `sg` over `grep`/`find`.
- The `Explore` subagent is the right tool for wide source scans; direct `rg`/`sg` for targeted follow-ups.
- Three independent scores, no composite — the user decides what matters based on the full profile.
