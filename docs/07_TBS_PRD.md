# TBS Product Requirements Document (PRD)

> TypeScript Bun Starter — Product vision, target personas, feature roadmap, and success criteria.

## 1. Product Identity

| Field | Value |
|---|---|
| **Product Name** | TypeScript Bun Starter (TBS) |
| **npm Package** | `@gobing-ai/typescript-bun-starter` |
| **Binary** | `tbs` |
| **Current Version** | 0.2.1 |
| **License** | MIT |
| **Repository** | github.com/gobing-ai/typescript-bun-starter |

## 2. Product Vision

**Be the fastest path from idea to production-grade Bun + TypeScript applications**, with strong architectural conventions, AI-agent-friendly workflows, and guardrails that eliminate boilerplate decisions.

### 2.1 Mission Statement

TBS eliminates the "blank canvas" problem for Bun-first TypeScript projects. It provides a scaffolded monorepo with pre-wired contracts, persistence, telemetry, and policy enforcement — so developers spend time on domain logic, not project plumbing.

### 2.2 Core Value Proposition

- **5 minutes to a production-ready project** — degit, install, init, build
- **Progressive complexity** — start with CLI-only, grow into API + Web as needed
- **AI-agent-native** — every command emits machine-readable JSON, documented contracts enable agents to operate autonomously
- **Guardrails, not handcuffs** — policy driver enforces conventions but can be extended or disabled

## 3. Target Personas

### Persona A: Solo Full-Stack Developer (Primary)

- Building personal projects, SaaS MVPs, or internal tools
- Wants Bun's speed but doesn't want to architect a monorepo from scratch
- Values convention over configuration
- Uses AI coding agents heavily
- **Pain point**: spending 2+ hours setting up project structure before writing first line of domain code

### Persona B: Small Team Lead

- Leading 2-5 developers on a greenfield project
- Needs consistent architecture across CLI, API, and web tiers
- Wants CI/CD, telemetry, and policy enforcement built-in
- **Pain point**: team members introduce inconsistent patterns, PR review is expensive

### Persona C: Existing Project Migrator

- Has a working Bun/TypeScript project
- Wants to adopt starter patterns incrementally without a rewrite
- Values the migration workflow (`migrate:analyze` / `migrate:apply`)
- **Pain point**: modernizing a project while keeping it running

## 4. Core Features (Current — v0.2.x)

| Feature | Status | Description |
|---|---|---|
| **Monorepo scaffold** | ✅ Shipped | Bun workspaces with `@starter/contracts`, `@starter/core`, `apps/cli`, `apps/server`, `apps/web` |
| **Project identity init** | ✅ Shipped | `scaffold init` rewrites package names, imports, docs, and CLI metadata |
| **Profile trimming** | ✅ Shipped | `scaffold add/remove` to select CLI-only, CLI+API, or CLI+API+Web |
| **Contract validation** | ✅ Shipped | `scaffold validate` checks project against `contracts/project-contracts.json` |
| **Policy driver** | ✅ Shipped | `bun run check:policy` enforces DB boundaries, logger usage, output patterns, external API access |
| **DB layer** | ✅ Shipped | Drizzle schema, Bun SQLite + Cloudflare D1 adapters, BaseDao, domain DAOs |
| **OpenAPI + Swagger** | ✅ Shipped | `@hono/zod-openapi` with Swagger UI at `/swagger` |
| **Telemetry SDK** | ✅ Shipped | OpenTelemetry tracing + metrics for HTTP and DB operations |
| **Observability stack** | ✅ Shipped | Docker Compose with OTel Collector + Jaeger for local development |
| **Migration workflow** | ✅ Shipped | `migrate:analyze` / `migrate:apply` for existing project adoption |
| **Agent mode (`--json`)** | ✅ Shipped | All scaffold commands have machine-readable output |
| **CI smoke tests** | ✅ Shipped | `smoke:generated` verifies full generated-project path |
| **Instruction generation** | ✅ Shipped | Auto-generates AGENTS.md, CLAUDE.md, GEMINI.md from contract |

## 5. Feature Roadmap

### v0.3 — Framework-Ready Foundation

| Feature | Priority | Description |
|---|---|---|
| **Rename npm package** | P0 | `@gobing-ai/starter` — clearer intent than `typescript-bun-starter` |
| **Core compilation proof** | P0 | Compile `packages/core` to JS + `.d.ts` as standalone artifact (proof of extractability) |
| **Framework roadmap doc** | P0 | `docs/03_FRAMEWORK_ROADMAP.md` documenting the path to `@gobing-ai/core` |
| **Expanded migration** | P1 | Smart merge for TypeScript files (AST-aware, not line-based) |
| **CLI man pages** | P2 | `tbs scaffold init --help` output parity with docs |

### v0.4 — Multi-Project Quality

| Feature | Priority | Description |
|---|---|---|
| **Extendable policy driver** | P1 | Custom policy files per project, importable policy presets |
| **Plugin system for scaffold** | P1 | Third-party feature registrations (`tbs scaffold add community:oauth`) |
| **Web tier component library** | P2 | Pre-built Astro components for common patterns (layout, nav, form) |
| **Auth middleware expansion** | P2 | JWT, OAuth2, session-based auth options |
| **DB migration tooling** | P2 | `bun run db:migrate` with rollback support |

### v0.5 — Mini-Framework Extraction

| Feature | Priority | Description |
|---|---|---|
| **`@gobing-ai/core` package** | P0 | Independently published, versioned, with stable API surface |
| **`@gobing-ai/contracts` package** | P0 | Standalone transport-safe DTOs |
| **Framework mode in scaffold** | P0 | `scaffold init --mode framework` generates projects with framework deps |
| **Upgrade guide** | P0 | Migration guide for starter→framework transition |
| **Version compatibility matrix** | P1 | Documented compat between core, contracts, and scaffold versions |

### v1.0 — Production-Grade Framework

| Feature | Priority | Description |
|---|---|---|
| **Stable API surface** | P0 | Semver-guaranteed core exports, changelog, deprecation policy |
| **Framework docs site** | P0 | Dedicated docs site with API reference, guides, and recipes |
| **Community templates** | P1 | Community-contributed scaffold features and project templates |
| **Performance benchmarks** | P1 | Published benchmarks for DB ops, HTTP throughput, cold start |
| **CD pipeline** | P1 | Automated release with changelog generation and npm publish |

## 6. Non-Goals (Explicitly Out of Scope)

| Area | Rationale |
|---|---|
| **ORM replacement** | Drizzle is the chosen ORM. No plans to abstract or replace it |
| **Multi-runtime support** | Bun-only. No Node.js, Deno, or browser runtime targets |
| **Framework-agnostic web tier** | Astro 6 + React islands is the web stack. No Next.js, SvelteKit, or Remix support |
| **Drag-and-drop UI builder** | The product is code infrastructure, not a visual tool |
| **Hosting/deployment platform** | TBS generates projects; it does not host them |
| **Package manager flexibility** | Bun is the only supported package manager |

## 7. Technical Requirements

### 7.1 Runtime & Tooling

| Constraint | Value |
|---|---|
| Runtime | Bun ≥ 1.3.0 |
| Language | TypeScript 6.x (strict mode) |
| Package manager | Bun (workspaces) |
| Lint/Format | Biome 2.x |
| Test runner | `bun:test` |
| CLI framework | Commander.js |
| API framework | Hono + `@hono/zod-openapi` |
| Web framework | Astro 6 + React 19 + Tailwind CSS v4 |
| ORM | Drizzle ORM |
| Telemetry | OpenTelemetry (OTLP HTTP) |

### 7.2 Quality Gates

Each commit must pass:

```bash
bun run check   # Biome + scaffold validate + docs + policy + typecheck + tests + coverage
```

### 7.3 AI Agent Contract

Every CLI command must support:

- `--json` flag for structured machine-readable output
- `--dry-run` flag for preview without side effects
- `--help` with complete option documentation
- Deterministic exit codes (0 = success, 1 = error)
- No interactive prompts when `--json` is set (fail with structured error instead)

### 7.4 Documentation Contract

Canonical docs must remain synchronized with the codebase. `bun run check:docs` enforces required/forbidden content patterns. Any code change that alters architecture, workflow, or conventions must update the relevant canonical doc in the same commit.

## 8. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| **Time-to-first-domain-code** | < 5 minutes | Time from `degit` to first custom DAO/route/handler |
| **Scaffold init success rate** | > 99% | CI smoke test pass rate |
| **`bun run check` pass rate** | 100% on `main` | CI gate |
| **npm downloads** | 100/week by v1.0 | npm registry stats |
| **Documentation freshness** | 0 stale doc violations | `bun run check:docs` |
| **Agent compatibility** | All commands support `--json` | Manual + CI verification |
| **Policy coverage** | 7+ enforced policies | `policies/` directory count |
| **Test coverage** | ≥ 80% line coverage | `bun run test` output |

## 9. Competitive Landscape

| Tool | What it does | TBS differentiator |
|---|---|---|
| `create-t3-app` | Next.js starter with tRPC, Prisma, Tailwind | TBS is Bun-first, monorepo-native, not React-centric |
| `create-astro` | Astro project generator | TBS includes API tier, DB layer, telemetry, policy enforcement |
| `create-hono` | Hono project generator | TBS includes scaffolding, contracts, migration workflow |
| AdonisJS | Full-stack Node.js framework | TBS is lighter, Bun-native, AI-agent-first |
| NestJS | Enterprise Node.js framework | TBS is minimal, convention-over-configuration, no decorators |

TBS occupies a unique position: **a scaffold-first monorepo starter that grows into a lightweight framework**, purpose-built for Bun, TypeScript strict mode, and AI-assisted development workflows.

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Bun ecosystem immaturity** | Breaking API changes, missing packages | Pin Bun version, test against Bun canary, maintain fallback paths |
| **Framework extraction complexity** | `@gobing-ai/core` API stability burden | Defer to v0.5+; gather evidence from real projects first |
| **User confusion (starter vs. framework)** | Adoption friction | Clear positioning, separate docs, `--mode` flag when framework ships |
| **Maintainer bandwidth** | Slow feature velocity | Policy driver reduces bespoke check scripts; automation-first design |
| **Competitor absorbs the niche** | Loss of relevance | Ship fast, stay Bun-native, build community around AI-agent workflows |

## 11. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04 | Defer framework extraction to v0.5+ | Architecture is framework-ready; need real-project evidence before committing to stable API |
| 2026-04 | Commander.js over Clipanion | Better TypeScript inference for command options, simpler subcommand registration |
| 2026-04 | Astro 6 over Astro 5 | Upgrade path was clean; Astro 6 brings improved island architecture |
| 2026-04 | Policy driver over bespoke check scripts | Single reusable driver reduces maintenance, enables consistent `--fix` behavior |
| 2026-04 | OpenTelemetry in `@starter/core` | Shared SDK prevents per-app telemetry duplication; apps import helpers, not OTel directly |
