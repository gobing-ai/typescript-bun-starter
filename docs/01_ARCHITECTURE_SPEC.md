# Architecture Specification: TypeScript Bun Starter

> Canonical architecture summary for the current starter. This file is intentionally concise and should match the repo as-shipped.

## 1. System Shape

The starter is a Bun workspace monorepo with one shared contracts package, one shared core package, and three
checked-in application tiers:

- **CLI** for scaffolding and local automation
- **API** for HTTP access and OpenAPI documentation
- **Web** for browser-facing UI built with Astro 5, React islands, and Tailwind CSS v4

The scaffold CLI is the control plane. It initializes project identity, adds or removes optional workspaces, and
validates that the generated project still matches the contract file.

## 2. Workspace Roles

| Workspace | Responsibility | Depends on |
| --- | --- | --- |
| `packages/contracts` | Shared transport-safe types and envelopes | none |
| `packages/core` | Drizzle schema, adapters, logging, core services | `@starter/contracts` |
| `apps/cli` | `tbs` scaffold CLI built with Clipanion | `@starter/core` |
| `apps/server` | Hono API, middleware, Swagger UI, optional static serving | `@starter/contracts`, `@starter/core` |
| `apps/web` | Astro 5 web tier, React islands, typed API client | `@starter/contracts` |

## 3. Dependency Boundaries

- `packages/contracts` stays runtime-light and has no internal workspace dependencies.
- `packages/core` may depend on `packages/contracts` but never on any app workspace.
- App workspaces never import from other app workspaces.
- Shared types cross API boundaries through `@starter/contracts`; shared business logic stays in `@starter/core`.

## 4. Runtime Model

### CLI

- Entry point: `apps/cli/src/index.ts`
- Framework: Clipanion
- Main responsibility: `scaffold init`, `scaffold add`, `scaffold remove`, `scaffold list`, `scaffold validate`

### Server

- Entry point: `apps/server/src/index.ts`
- Framework: Hono with `@hono/zod-openapi` and Swagger UI
- Health endpoints live at `/` and `/api/health`
- Demo CRUD endpoints live under `/api/skills`
- If `apps/web/dist` exists, the server can serve the built web app as static fallback content

### Web

- Entry point: `apps/web/src/pages`
- Framework: Astro 5
- Interactivity model: React islands only where client-side hydration is needed
- Styling: Tailwind CSS v4
- API access: browser-safe client helpers live under `apps/web/src/lib`

## 5. Scaffold Contract

`contracts/project-contracts.json` is the generated-project contract. It defines:

- project identity fields rewritten by `scaffold init`
- required and optional workspaces
- allowed workspace dependency rules
- required root scripts
- file naming rules

`scaffold validate` is the repo-native integrity check for that contract. CI runs it both on the repository itself and
on a generated temp copy via `bun run smoke:generated`.

## 6. Profiles

| Profile | Included tiers | Notes |
| --- | --- | --- |
| CLI + API + Web | CLI + API + Web | Default checkout |
| CLI + API | CLI + API | Remove `webapp` via scaffold |
| CLI only | CLI | Remove `webapp`, then `server`, via scaffold |

The CLI tier is always present because it owns the project-shaping workflow.

## 7. Verification Strategy

- `bun run check` is the local gate: Biome, scaffold validation, docs validation, typecheck, tests, and coverage enforcement
- `bun run smoke:generated` verifies the generated project path by running `scaffold init`, `scaffold remove`, `scaffold add`, and `scaffold validate` inside a temp copy
- GitHub Actions runs both gates on every PR and on pushes to `main`

## 8. ADRs

### ADR-001: Bun workspaces over orchestration layers

Use native Bun workspaces. The repo is small enough that Turborepo/Nx would add ceremony without solving a pressing problem.

### ADR-002: Clipanion for CLI structure

Use Clipanion for hierarchical scaffold commands and predictable `--json` behavior.

### ADR-003: Astro for the web tier

Use Astro 5 with React islands and Tailwind CSS v4 for the browser tier. The server stays focused on HTTP concerns while the browser tier can remain mostly static and hydrate only the interactive pieces.

### ADR-004: Shared contracts and shared core remain separate

Keep `@starter/contracts` isolated from persistence and business logic so the web tier and external clients can depend on transport types without pulling database or server concerns with them.
