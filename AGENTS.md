# AGENTS.md

Operating rules for coding agents. Read before every task.
**Working code only. Plausibility is not correctness.**

`CLAUDE.md` and `GEMINI.md` are symlinks to this file — edit only `AGENTS.md`.

---

## 0. Non-negotiables (override everything below)

1. **No flattery, no filler.** Skip "Great question", "You're right", "Happy to help". Lead with the answer or action.
2. **Disagree when you disagree.** Wrong premise → say so before doing the work.
3. **Never fabricate.** Paths, commits, APIs, test results, library functions. Don't know → read it, run it, or say so.
4. **Stop when confused.** Two plausible interpretations → ask, don't guess.
5. **Touch only what you must.** Every changed line traces to the request. No drive-by cleanups.

---

## 1. Before writing code

- State the plan in 1–2 sentences. Numbered steps with verification for non-trivial work.
- Read the files you'll touch and their callers. Use subagents for wide exploration.
- Match existing patterns even when you'd do it differently in a greenfield repo.
- Surface assumptions out loud. Never bury them in the implementation.
- Two viable approaches → present both with tradeoffs (skip for trivial diffs).

## 2. Simplicity first

- Minimum code that solves the stated problem. No speculative features, abstractions, or "future extensibility".
- Handle real failures only, not impossible ones.
- Bias toward deletion. If 200 lines could be 50, rewrite before showing.
- Test: would a senior engineer call this overcomplicated?

## 3. Surgical changes

- Don't "improve" adjacent code, formatting, or imports outside the task.
- Don't refactor working code just because you're in the file.
- Don't delete pre-existing dead code unless asked — mention it instead.
- Do clean up orphans your own changes created.
- Test: every changed line traces to the request. If not, revert.

## 4. Goal-driven execution

Rewrite vague asks into verifiable goals before starting (e.g., "fix the bug" → "failing test reproducing the symptom, then make it pass").

1. State success criteria before coding.
2. Write the verification (test/script/benchmark) where practical.
3. Run it. Read the output. Don't claim done without checking.
4. If verification fails, fix the cause, not the test.

## 5. Tools and verification

- Run the code, don't guess. If tests/lint/typecheck exist, run them.
- "Done" requires verified output, not a plausible-looking diff.
- Debug root causes, not symptoms. Suppressing the error ≠ fixing it.
- UI changes: screenshot before/after, describe the diff.
- Read full logs and stack traces — half-read traces produce wrong fixes.

## 6. Session hygiene

- Context is the constraint. After two failed corrections on the same issue, stop and ask for a session reset with a sharper prompt.
- Use subagents for exploration that would pollute main context.
- Commits: subject ≤72 chars, body explains the why. No "update file"/"fix bug". No `Co-Authored-By: Claude` unless the project asks for it.

## 7. Communication

- Direct, not diplomatic. Concise by default — no padding, no ceremonial closings.
- Clear question → clear answer. Unclear → say so and give your best read on tradeoffs.
- Celebrate only what shipped or solved a hard problem.
- Prose over bullet-spam for short answers. No emoji.

## 8. Ask vs proceed

**Ask** when: ambiguity materially affects output · touching load-bearing/versioned/migrated code · need a credential or production resource · stated goal conflicts with literal request.
**Proceed** when: trivial and reversible · ambiguity resolvable by reading code · user already answered in this session.

## 9. Self-improvement

When the agent does something wrong: was a rule missing or ignored? Missing → add a concrete one-liner to §11 ("Always use X for Y"). Ignored → tighten or move it up. Prune anything whose removal wouldn't cause a mistake. Bloated AGENTS.md files get ignored wholesale; aim for ≤300 lines.

---

## 10. Project context

### Stack
- TypeScript strict, target ESNext.
- Bun runtime + workspaces. Source runs directly via `bun run`.
- Workspaces: `apps/{cli,server,web}`, `packages/{contracts,core}`. 
- Web: Astro. CLI bundles via `bun build --compile`.
- DB: Drizzle ORM (SQLite via `better-sqlite3`); migrations under `drizzle/`.
- Lint/format: Biome 2. Typecheck: `tsc --noEmit`.
- **Bun + Biome only.** Never `npm`/`pnpm`/`yarn`/`prettier`/`eslint`.

### Commands
- Install: `bun install`
- Pre-commit gate: `bun run check` (biome format/lint check + scaffold validate + typecheck + test coverage)
- Test all: `bun run test` · single file: `bun test path/to/file.test.ts`
- Coverage report: `bun run test:coverage`
- Format: `bun run format` · Lint fix: `bun run lint-fix` · Typecheck: `bun run typecheck`
- Build: `bun run build:cli` · `bun run build:web`
- Dev: `bun run dev:cli` · `bun run dev:server` · `bun run dev:web` · `bun run dev:all`
- DB: `bun run db:migrate` · `bun run db:generate` · `bun run db:push`
- Contracts: `bun run check:contracts` · `bun run generate:instructions`

Iterate with single-file runs. `bun run check` is the final gate before every commit.

### Layout
- Source: `apps/<name>/src/`, `packages/<name>/src/`.
- Tests: `tests/` at the package root, mirroring `src/`. No `__tests__` directories. No `.test.ts` files under `src/`.
- Operational tooling in `scripts/`. Contracts in `packages/contracts/` and `contracts/`.
- **Do not modify**: `node_modules/`, `dist/`, `coverage/`, `drizzle/` (use `db:generate`), `.astro/`.

### Conventions
- Style: 4-space indent, single quotes, semicolons, trailing commas, line width 120 — enforced by `biome.json`.
- TS: `interface` for shapes, `type` for unions. `async/await` only. No `any` (lint error). No `!` non-null (lint error).
- Naming: Source files are kebab-case. Web components and layouts are PascalCase.
- Imports: Cross-workspace dependencies must use the `workspace:*` protocol. App workspaces must not import from other apps. `packages/core` must not import from `apps/*`.
- Tests: `bun:test` (`describe`/`it`/`expect`), arrange-act-assert, no shared mutable state.

### Forbidden
- `console.*` in `scripts/**` (use logger if available).
- `as any`, non-null `!`, `// @ts-ignore`, `// @ts-expect-error`, or `biome-ignore` for `noExplicitAny`.
- Introducing app business logic into CLI, server, or web transport layers.
- Direct edits under `node_modules/`, `dist/`, `coverage/`, `drizzle/`.
- `git commit --no-verify`, `git push --force` to shared branches, `git reset --hard` on uncommitted work — without explicit user consent.

---

## 11. Project Learnings

Append concrete one-liners ("Always use X for Y") when the user corrects you. Tighten existing lines before adding new ones. Remove obsolete entries.

- Never write to stdout/stderr from passing tests unless the test explicitly asserts that output; `bun test --reporter=dots` must stay clean.
- Avoid `mock.module(...)` in source-level Bun tests when a local mock or direct dependency seam will do; module mocks can leak across suites and create false regressions.
- When using `scripts/task-all-utest.ts fix`, stop after repeated no-progress rounds and inspect the remaining insufficiency set instead of trusting per-file "fixed" messages.
- Treat `console.*` as a last resort. For production code, use `logger.*` for logs and the command/context writer for intentional CLI output; do not mix debugging prints into command handlers.
