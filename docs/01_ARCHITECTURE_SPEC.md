# Architecture Specification: TypeScript Bun Starter

> Canonical architecture summary for the current starter. This file is intentionally concise and should match the repo as-shipped.

## 1. System Shape

The starter is a Bun workspace monorepo with one shared contracts package, one shared core package, and three
checked-in application tiers:

- **CLI** for scaffolding and project-shaping automation
- **API** for HTTP access and OpenAPI documentation
- **Web** for browser-facing UI built with Astro 6, React islands, and Tailwind CSS v4

The scaffold CLI is the control plane. It initializes project identity, adds or removes optional workspaces, and
validates that the generated project still matches the contract file. A reusable **policy driver** enforces
repository rules across naming, imports, DB boundaries, logger usage, and external API access.

## 2. Workspace Roles

| Workspace | Responsibility | Depends on |
| --- | --- | --- |
| `packages/contracts` | Shared transport-safe types and envelopes | none |
| `packages/core` | Drizzle schema, DB adapters, logging, telemetry SDK, DAOs, errors, typed HTTP client | `@starter/contracts` |
| `apps/cli` | `tbs` scaffold CLI built with Commander.js | `@starter/core` |
| `apps/server` | Hono API, middleware, Swagger UI, optional static serving | `@starter/contracts`, `@starter/core` |
| `apps/web` | Astro 6 web tier, React islands, typed API client | `@starter/contracts` |

## 3. Dependency Boundaries

- `packages/contracts` stays runtime-light and has no internal workspace dependencies.
- `packages/core` may depend on `packages/contracts` but never on any app workspace.
- App workspaces never import from other app workspaces.
- Shared types cross API boundaries through `@starter/contracts`; shared business logic stays in `@starter/core`.

## 4. Runtime Model

### CLI

- Entry point: `apps/cli/src/index.ts`
- Framework: Commander.js with `@commander-js/extra-typings` for type-safe option parsing
- Main responsibility: `scaffold init`, `scaffold add`, `scaffold remove`, `scaffold list`, `scaffold validate`
- Dual-mode output: human-readable (interactive with prompts) and `--json` (for AI agents and CI)

### Server

- Entry point: `apps/server/src/index.ts`
- Framework: Hono with `@hono/zod-openapi` and Swagger UI
- Health endpoints live at `/` and `/api/health`
- Demo CRUD endpoints live under `/api/skills`
- If `apps/web/dist` exists, the server can serve the built web app as static fallback content
- OpenTelemetry integration for distributed tracing and metrics

### Web

- Entry point: `apps/web/src/pages`
- Framework: Astro 6
- Interactivity model: React islands only where client-side hydration is needed
- Styling: Tailwind CSS v4
- API access: browser-safe client helpers live under `apps/web/src/lib`

### Cloudflare Deployment

**Server → Cloudflare Workers**

- Config: `apps/server/wrangler.toml` — Worker name, D1 binding, KV (SESSION) binding, cron triggers, environment sections
- The existing Hono `fetch` export is already CF Worker-compatible; the `scheduled` export (from `apps/server/src/scheduled.ts`) is only invoked on CF cron triggers
- Cron dispatch: `scheduled(event)` uses `CloudflareSchedulerAdapter.getJobByCron(event.cron)` to find and invoke the matching job at runtime
- Scripts: `bun run deploy:server` (wrangler deploy), `bun run dev:server:cf` (wrangler dev)
- Dual-mode: the same entry point works with `bun --hot run` locally and `wrangler deploy` for production; no code branching required

**Web → Cloudflare Pages**

- Config: `apps/web/wrangler.toml` — Pages project name, output directory
- Adapter: `@astrojs/cloudflare` with `output: 'static'` (default); switch to `output: 'server'` for SSR
- CF Pages routing: `public/_headers` (security headers, cache policies) and `public/_routes.json` (route inclusion/exclusion)
- Scripts: `bun run deploy:web` (build + wrangler pages deploy), `bun run preview:web:cf` (wrangler pages dev)

### Policy Driver

- Entry point: `scripts/policy-check.ts`
- Configuration: one JSON policy file per concern under `policies/`
- Engine: ripgrep-based text matching with optional auto-fix via `rewrite` and `command` fix actions
- Covered concerns: Bun-only workflow, bun-test migration, DB boundaries, logger usage, output boundaries, external API boundaries, git safety
- Integrated into `bun run check` and available standalone as `bun run check:policy`

## 5. Shared Infrastructure

### Telemetry SDK (`packages/core/src/telemetry/`)

A reusable OpenTelemetry layer for the Bun runtime:

- **SDK init** (`sdk.ts`): initializes `NodeTracerProvider` with OTLP HTTP export, configurable via env vars (`TELEMETRY_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`)
- **Tracing helpers** (`tracing.ts`): `traceAsync()` for wrapping DB and HTTP operations, `addSpanAttributes()`, `addSpanEvent()`, and `withActiveSpan()`
- **Metrics** (`metrics.ts`): pre-built counters and histograms for HTTP server requests, HTTP client requests, and DB operations
- **Config** (`config.ts`): env-var driven `TelemetryConfig` with safe defaults
- **DB sanitization** (`db-sanitize.ts`): strips SQL parameters from span attribute values to prevent PII leakage

### Database Layer (`packages/core/src/db/`)

- **Adapter abstraction** (`adapter.ts`): `DbClient` and `DbAdapter` interfaces decouple application code from runtime drivers
- **Concrete adapters**: Bun SQLite (`adapters/bun-sqlite.ts`) and Cloudflare D1 (`adapters/d1.ts`)
- **Base DAO** (`base-dao.ts`): thin base class with `DbClient` storage and `now()` helper
- **Domain DAOs** (`skills-dao.ts`): query composition class extending `BaseDao`, consumed by route handlers

### HTTP Client Boundaries

- **Server-side** (`packages/core/src/api-client.ts`): `fetchApi()` with timeout, OpenTelemetry spans, and `APIError` for non-2xx responses
- **Browser-side** (`apps/web/src/lib/browser-api-client.ts`): `ApiResponse<T>` envelopes, isolated from `@starter/core`
- **Shared helpers** (`packages/contracts/src/http-client.ts`): header normalization and response parsing used by both wrappers

## 6. Scaffold Contract

`contracts/project-contracts.json` is the generated-project contract. It defines:

- project identity fields rewritten by `scaffold init`
- required and optional workspaces
- allowed workspace dependency rules
- required root scripts
- file naming rules
- instruction generation policy (AGENTS.md, CLAUDE.md, GEMINI.md)

`scaffold validate` is the repo-native integrity check for that contract. CI runs it both on the repository itself and
on a generated temp copy via `bun run smoke:generated`.

## 7. Migration Workflow

The starter ships as an npm package (`@gobing-ai/typescript-bun-starter`) with an incremental migration workflow
for existing projects:

- `migrate:analyze` — diff the starter source against the target project, produce a migration plan
- `migrate:apply` — execute the stored migration plan with per-file actions (copy, skip, merge)

This enables pattern adoption without a full degit-and-port. See `docs/existing-project-migration-guide.md`.

## 8. Profiles

| Profile | Included tiers | Notes |
| --- | --- | --- |
| CLI + API + Web | CLI + API + Web | Default checkout |
| CLI + API | CLI + API | Remove `webapp` via scaffold |
| CLI only | CLI | Remove `webapp`, then `server`, via scaffold |

The CLI tier is always present because it owns the project-shaping workflow.

## 9. Verification Strategy

- `bun run check` is the local gate: Biome, scaffold validation, docs validation, policy checks, typecheck, tests, and coverage enforcement
- `bun run check:policy` runs the repository policy driver across all policy documents under `policies/`
- `bun run smoke:generated` verifies the generated project path by running `scaffold init`, `scaffold remove`, `scaffold add`, and `scaffold validate` inside a temp copy
- `bun run check:docs` enforces required/forbidden content in canonical documentation files
- GitHub Actions runs all gates on every PR and on pushes to `main`

## 10. Observability Stack (Optional)

For local tracing during development:

```bash
bun run dev:observability    # brings up OTel Collector + Jaeger via Docker Compose
```

The compose stack lives under `dockers/` and routes OTLP HTTP traffic (port 4318) through an OpenTelemetry Collector
into Jaeger (UI at `http://localhost:16686`). The server auto-initializes telemetry when `TELEMETRY_ENABLED=true`.

## 11. Canonical Documentation

The canonical docs checked by `bun run check:docs`:

- `README.md` — landing page, quick start, profiles, verification, telemetry
- `docs/01_ARCHITECTURE_SPEC.md` — this file
- `docs/02_DEVELOPER_SPEC.md` — implementation guide for repo contributors
- `docs/04_SCAFFOLD_GUIDE.md` — scaffold command reference and workflow
- `docs/05_DATABASE_ACCESS.md` — database layering, adapters, DAO conventions
- `docs/06_POLICY_CHECK.md` — policy driver guide, policy file model, fix actions

## 12. ADRs

### ADR-001: Bun workspaces over orchestration layers

Use native Bun workspaces. The repo is small enough that Turborepo/Nx would add ceremony without solving a pressing problem.

### ADR-002: Commander.js for CLI structure

Use Commander.js with `@commander-js/extra-typings` for type-safe option parsing, hierarchical `scaffold` subcommands, and predictable `--json` behavior. Commander.js provides better TypeScript inference for command options and a more straightforward subcommand registration API than the previous CLI framework.

### ADR-003: Astro 6 for the web tier

Use Astro 6 with React islands and Tailwind CSS v4 for the browser tier. The server stays focused on HTTP concerns while the browser tier can remain mostly static and hydrate only the interactive pieces.

### ADR-004: Shared contracts and shared core remain separate

Keep `@starter/contracts` isolated from persistence and business logic so the web tier and external clients can depend on transport types without pulling database or server concerns with them.

### ADR-005: Reusable policy driver over bespoke check scripts

A single reusable policy driver (`scripts/policy-check.ts`) with JSON policy files replaces the proliferation of one-off `check-*.ts` scripts. Each policy file declares rules with ripgrep patterns, severity levels, and optional fix actions. This keeps enforcement consistent and makes adding new rules low-ceremony.

### ADR-006: OpenTelemetry as shared infrastructure, not per-app wiring

The telemetry SDK lives in `@starter/core` so all apps inherit tracing, metrics, and DB span instrumentation without duplicating OpenTelemetry bootstrap logic. Application code imports `traceAsync()` and metric helpers from `@starter/core` rather than wiring `@opentelemetry/*` packages directly.
