# GEMINI.md -- TypeScript Bun Starter

This file is consumed by Gemini tooling and mirrors the root repository contract.

> Generated file. Do not edit directly.
> Edit `contracts/project-contracts.json`, `scripts/generate-instructions.ts`, then run `bun run generate:instructions`.

## Purpose

- This file is the repo-wide execution contract for agentic changes.
- Keep root instructions concise and broadly applicable.
- Put subtree-specific rules in nested AGENTS.md files.
- Put deterministic policy in contracts/project-contracts.json and enforce it in scripts/check-contracts.ts.
- If you change structure, naming, or workspace boundaries, update the contract and regenerate these files in the same patch.

## Scope And Precedence

- This file applies to the entire repository unless a deeper AGENTS.md overrides part of it.
- Nested AGENTS.md files under packages/contracts, packages/core, apps/cli, apps/server, and apps/web are authoritative for those subtrees.
- Treat docs/01_ARCHITECTURE_SPEC.md and docs/02_DEVELOPER_SPEC.md as canonical references for examples and rationale, not as substitutes for this contract.

## Mandatory Verification

After any intentional repo change, run:

```bash
bun run check
```

bun run check is the definition-of-done gate for this starter. It must cover linting, contract checks, generated-instruction sync, type checking, tests, and coverage.

## Repository Contract

- packages/contracts owns shared cross-tier contracts and transport-safe DTOs.
- packages/core is the shared domain and data layer built on top of @starter/contracts when contracts are needed.
- apps/cli, apps/server, and apps/web are optional interface tiers built on top of @starter/contracts and @starter/core.
- Existing workspace package names must follow @starter/<name>.
- Cross-workspace dependencies must use the workspace:* protocol.
- App workspaces must not import from other app workspaces.
- packages/core must not import from apps/*.
- If a tier is removed, remove its workspace folder, root scripts, and stale references in docs or starter copy.

## Naming And Placement

- Source files are kebab-case by default.
- Web UI components in apps/web/src/components use PascalCase.
- Web layouts in apps/web/src/layouts use PascalCase.
- Tests live in tests/ at the package root and mirror src/.
- Do not create __tests__ directories.
- Do not place .test.ts or .spec.ts files under src/.
- Keep public workspace exports in src/index.ts.

## Code Rules

- Runtime stack: Bun workspaces, TypeScript strict mode, Biome.
- Do not suppress noExplicitAny with biome-ignore.
- Do not introduce app business logic into CLI, server, or web transport layers.
- Prefer thin handlers and commands that delegate to @starter/core.
- Keep generated or vendor-specific instructions aligned with this contract.
- NEVER add entries to the NO_TEST_REQUIRED Set in scripts/check-coverage.ts. Only humans may add coverage exemptions. When a source file lacks test coverage, write real tests for it instead of bypassing the coverage gate.

## Change Approval Boundaries

Ask before changing any of the following:

- .github/workflows/
- Dockerfile*
- .env*
- drizzle/ migrations
- workspace layout beyond the allowed starter tiers
- runtime or framework swaps
- root package manager decisions

## Canonical References

- contracts/project-contracts.json
- scripts/check-contracts.ts
- scripts/generate-instructions.ts
- docs/01_ARCHITECTURE_SPEC.md
- docs/02_DEVELOPER_SPEC.md
