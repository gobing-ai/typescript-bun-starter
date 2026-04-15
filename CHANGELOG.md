# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
- **Monorepo starter**: Production-ready TypeScript + Bun monorepo with three tiers — shared core (`packages/core`), CLI (`apps/cli`), and API server (`apps/server`)
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
