# AGENTS.md -- TypeScript Bun Starter

## Purpose

This file is the repo-wide execution contract for agentic changes.

- Keep this file concise and broadly applicable.
- Put subtree-specific rules in nested `AGENTS.md` files.
- Put deterministic policy in `contracts/project-contracts.json` and enforce it in `scripts/check-contracts.ts`.
- If you change structure, naming, or workspace boundaries, update `AGENTS.md` and `contracts/project-contracts.json` in the same patch.

## Scope And Precedence

- This file applies to the entire repository unless a deeper `AGENTS.md` overrides part of it.
- Nested `AGENTS.md` files under `packages/core`, `apps/cli`, `apps/server`, and `apps/web` are authoritative for those subtrees.
- Treat `docs/01_ARCHITECTURE_SPEC.md` and `docs/02_DEVELOPER_SPEC.md` as canonical references for examples and rationale, not as substitutes for this contract.

## Mandatory Verification

After any intentional repo change, run:

```bash
bun run check
```

`bun run check` is the definition-of-done gate for this starter. It must cover linting, contract checks, type checking, tests, and coverage.

## Repository Contract

- `packages/core` is the shared domain and data layer.
- `apps/cli`, `apps/server`, and `apps/web` are optional interface tiers built on top of `@project/core`.
- Existing workspace package names must follow `@project/<name>`.
- Cross-workspace dependencies must use the `workspace:*` protocol.
- App workspaces must not import from other app workspaces.
- `packages/core` must not import from `apps/*`.
- If a tier is removed, remove its workspace folder, root scripts, and stale references in docs or starter copy.

## Naming And Placement

- Source files are kebab-case by default.
- Web UI components in `apps/web/src/components` use PascalCase.
- Web layouts in `apps/web/src/layouts` use PascalCase.
- Tests live in `tests/` at the package root and mirror `src/`.
- Do not create `__tests__` directories.
- Do not place `.test.ts` or `.spec.ts` files under `src/`.
- Keep public workspace exports in `src/index.ts`.

## Code Rules

- Runtime stack: Bun workspaces, TypeScript strict mode, Biome.
- Do not suppress `noExplicitAny` with `biome-ignore`.
- Do not introduce app business logic into CLI, server, or web transport layers.
- Prefer thin handlers and commands that delegate to `@project/core`.
- Keep generated or vendor-specific instructions aligned with this file.

## Change Approval Boundaries

Ask before changing any of the following:

- `.github/workflows/`
- `Dockerfile*`
- `.env*`
- `drizzle/` migrations
- workspace layout beyond the allowed starter tiers
- runtime or framework swaps
- root package manager decisions

## Canonical References

- Machine-readable contract: `contracts/project-contracts.json`
- Contract checker: `scripts/check-contracts.ts`
- Architecture reference: `docs/01_ARCHITECTURE_SPEC.md`
- Developer reference: `docs/02_DEVELOPER_SPEC.md`
