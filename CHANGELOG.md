# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-24

### New Features

- **Project bootstrap overhaul**: Added a fuller project initialization flow so generated repos start from a more complete, ready-to-customize baseline
- **Scaffold-first workflow**: Replaced the older skill-centric setup flow with scaffold commands, making project setup and iteration more consistent
- **Shared database boundary**: Introduced `DbClient` and `BaseDao` patterns to centralize data access and keep database concerns behind a stable abstraction
- **Policy enforcement CLI**: Added `scripts/policy-check.ts` plus repo policies to enforce architectural boundaries such as DB access, logging, output handling, and external API centralization
- **Telemetry by default**: Added OpenTelemetry-based tracing and metrics across server and client HTTP paths, database operations, and shared runtime helpers

### Improvements

- **Stronger output model**: Expanded shared output handling so CLI and script output is more consistent and easier to validate in tests
- **Hardened starter defaults**: Tightened project configuration, workspace conventions, and generated templates to reduce drift and improve out-of-the-box reliability
- **Centralized API access**: Consolidated shared HTTP behavior and clarified browser-vs-core client responsibilities to reduce duplicate transport code and inconsistent request handling
- **Modernized web stack**: Upgraded the web tier to Astro 6, `@astrojs/react` 5, and `@astrojs/cloudflare` 13
- **TypeScript 6 upgrade**: Updated the workspace to TypeScript 6.0.3 and aligned the configuration for the newer compiler behavior
- **CI dependency refresh**: Upgraded `actions/checkout` from v4 to v6

### Bug Fixes

- **Logging stability**: Fixed logger initialization issues so shared logging works more reliably across app and script entry points
- **HTTP client correctness**: Fixed duplicated API-client responsibilities and aligned response parsing, empty-body handling, and browser request behavior
- **Template consistency**: Updated generated web templates and project instructions to match the new scaffold, policy, and client boundaries

## [0.1.5] - 2026-04-15

### New Features

- **Optional web tier**: Added `apps/web` with Astro 5, React islands, Tailwind CSS v4, and a shared typed API client for projects that need a first-party UI
- **Integrated web development flow**: Added `bun run dev:web`, `bun run dev:all`, and `bun run build:web`, plus a dashboard demo and local API proxy workflow
- **Existing project migration guide**: Added `docs/existing-project-migration-guide.md` with an AI-assisted adoption model, human approval gates, phased workstreams, and concrete command sequences for smoother migrations

### Improvements

- **Stronger starter contracts**: Added repository contract checks and generated-instruction sync so workspace boundaries, naming rules, and agent-facing instructions stay aligned
- **Stronger verification gate**: Expanded `bun run check` to include contract validation and instruction drift checks in addition to linting, type checking, tests, and coverage
- **Sharper starter documentation**: Updated the README and user-facing docs to cover optional tiers, local web development, and downstream adoption into existing projects

## [0.1.3] - 2026-04-12

### New Features

- **`bun run bootstrap`**: Contract-aware project identity rewrite for spawned repos, covering package names, workspace imports, generated instruction files, and starter copy
- **Monorepo starter**: Production-ready TypeScript + Bun monorepo with shared contracts (`packages/contracts`), shared core (`packages/core`), CLI (`apps/cli`), and API server (`apps/server`)
- **Skills CRUD demo**: Working example across all three tiers demonstrating schema, service, CLI commands, and OpenAPI routes
- **`bun run clean-demo`**: One-command cleanup to strip the demo code and leave a clean skeleton for your own domain
- **`bun run pub2npmjs`**: Publish the project to npm as `@gobing-ai/typescript-bun-starter`
- **Database layer**: Drizzle ORM with SQLite (Bun `bun:sqlite` or Cloudflare D1), migration support via `drizzle-kit`
- **CLI**: Clipanion-based with dual-mode output (human-readable + `--json` machine output)
- **API server**: Hono + `@hono/zod-openapi` with auto-generated Swagger UI and OpenAPI spec
- **Pre-commit gate**: `bun run check` runs Biome lint/format, TypeScript strict mode, and test suite with coverage thresholds
- **Test infrastructure**: In-memory SQLite for fast unit tests, 99%+ line coverage across all packages

### Tech Stack

- Bun runtime, TypeScript (strict), Drizzle ORM, Zod, Clipanion, Hono, Biome, LogTape
