# Developer Specification: TypeScript Bun Starter

> Implementation guide for working on the current starter. This document describes the repo as it exists today, not historical experiments.

## 1. Prerequisites

| Tool | Version | Purpose |
| --- | --- | --- |
| Bun | 1.x | runtime, package manager, test runner, bundler |
| TypeScript | 5.7+ | static typing |
| Biome | 2.x | formatting and linting |

No npm, pnpm, yarn, ESLint, or Prettier in the main path.

## 2. Workspace Overview

| Path | Responsibility |
| --- | --- |
| `packages/contracts` | shared transport-safe contracts |
| `packages/core` | shared logic, logging, Drizzle schema, adapters |
| `apps/cli` | scaffold CLI |
| `apps/server` | Hono API and Swagger UI |
| `apps/web` | Astro 5 web app using React islands |

## 3. Daily Commands

```bash
bun install
bun run check
bun run test
bun run typecheck
bun run format
bun run lint-fix
bun run dev:cli
bun run dev:server
bun run dev:web
bun run dev:all
```

## 4. Initializing a New Project

The fastest supported starter flow does **not** require compiling the CLI first:

```bash
bunx degit gobing-ai/typescript-bun-starter my-project && cd my-project
bun install
bun run scaffold:init -- --name my-project --scope @acme
bun run check
```

If you want a standalone binary after that:

```bash
bun run build:cli
./dist/tbs scaffold init --name my-project --scope @acme
```

## 5. Scaffold Workflow

Available scaffold commands:

```bash
bun run scaffold:init -- --name my-project --scope @acme --title "My Project"
bun run scaffold:list
bun run scaffold:add -- webapp
bun run scaffold:remove -- webapp
bun run scaffold:validate
bun run scaffold:validate -- --fix
```

Rules:

- `cli` is required and always present
- `server` and `webapp` are optional features
- `contracts/project-contracts.json` is the source of truth for project identity and workspace rules
- any change to scaffold behavior must keep `scaffold validate` green

## 6. Local Development

### CLI

```bash
bun run dev:cli -- --help
```

### API

```bash
bun run dev:server
```

- default local port: `3000`
- Swagger UI: `/swagger`
- OpenAPI JSON: `/doc`
- API health: `/api/health`

### Web

```bash
bun run dev:web
```

- Astro dev server runs on `4321`
- the checked-in web app uses a shared API client and shared types from `@starter/contracts`
- `bun run dev:all` launches the Hono API and Astro dev server together with a Bun script instead of shell backgrounding

## 7. Generated-Project Verification

Two checks matter:

```bash
bun run check
bun run smoke:generated
```

- `bun run check` validates the repository itself
- `bun run smoke:generated` copies the repo into a temp directory and verifies `scaffold init`, `scaffold add`, `scaffold remove`, and `scaffold validate`

## 8. Coding Conventions

- strict TypeScript only; no `any`
- `interface` for object shapes, `type` for unions
- `async/await` instead of promise chains
- app workspaces must not import from other app workspaces
- `packages/core` must not depend on `apps/*`
- shared API-facing types belong in `@starter/contracts`
- server handlers stay thin; business logic belongs in `@starter/core`
- browser-safe fetching and API helpers stay under `apps/web/src/lib`

## 9. Script Conventions

- Root workspace scripts should be Bun-native and workspace-aware where possible.
- `apps/web` owns its own Astro `dev` and `build` scripts.
- `apps/server` owns its own `dev` script.
- Cross-workspace orchestration belongs in `scripts/`, not shell background operators.

## 10. Documentation Contract

The canonical docs checked by `bun run check:docs` are:

- `README.md`
- `docs/01_ARCHITECTURE_SPEC.md`
- `docs/02_DEVELOPER_SPEC.md`
- `docs/04_SCAFFOLD_GUIDE.md`

These files must stay aligned on:

- the Bun workspace layout
- Astro 5 + React islands + Tailwind CSS v4 as the web stack
- the scaffold-first onboarding flow
- the generated-project verification story
