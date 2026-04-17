# TypeScript Bun Starter

A production-ready monorepo starter for building **CLI**, **CLI + API**, or
**CLI + API + Web** projects with TypeScript and Bun.

## What You Get

- **`packages/contracts`** -- Shared transport-safe contracts, API envelopes, error mappers,
  and cross-tier DTOs
- **`packages/core`** -- Shared business logic, database layer (Drizzle ORM + SQLite/D1),
  validation (Zod), logging helpers, and services
- **`apps/cli`** -- Type-safe CLI via Clipanion with dual-mode output (human + `--json`)
- **`apps/server`** -- REST API with auto-generated OpenAPI docs (Hono + Swagger UI),
  health endpoints, and optional static serving for the built web app
- **`apps/web`** -- Astro 5 web app with React islands, Tailwind CSS v4, and a shared
  typed API client
- **Biome**, **LogTape**, and **strict TypeScript** throughout

The project ships with a working "skills" CRUD example for the CLI and API tiers, plus an
Astro dashboard that demonstrates React islands and a typed health check call.

## Quick Start

```bash
# via degit (recommended — clean copy, no git history)
bunx degit gobing-ai/typescript-bun-starter my-project && cd my-project
bun install
tbs scaffold init --name my-project --scope @acme --title "My Project"
bun run check        # lint + typecheck + test (all should pass)

# or clone from GitHub
git clone https://github.com/gobing-ai/typescript-bun-starter.git my-project && cd my-project
bun install
tbs scaffold init --name my-project --scope @acme --title "My Project"
bun run check
```

> **npm package:** [`@gobing-ai/typescript-bun-starter`](https://www.npmjs.com/package/@gobing-ai/typescript-bun-starter)

### Scaffold Commands

Use `tbs scaffold` to manage project features and identity:

```bash
# Initialize project identity
tbs scaffold init --name my-project --scope @acme

# Preview without applying
tbs scaffold init --name my-project --scope @acme --dry-run

# Customize CLI binary name
tbs scaffold init --name my-project --scope @acme --bin mp

# Customize branding
tbs scaffold init --name my-project --scope @acme --title "My Project Platform" --brand "My Project"

# Skip post-init verification
tbs scaffold init --name my-project --scope @acme --skip-check

# List all features with status
tbs scaffold list

# Add optional features
tbs scaffold add cli        # Clipanion CLI tool
tbs scaffold add server     # Hono REST API server
tbs scaffold add webapp     # Astro web application

# Skills CRUD domain is built-in (always installed)

# Remove optional features
tbs scaffold remove webapp

# Validate project contracts
tbs scaffold validate --fix
```

Run `tbs scaffold --help` for all options.

### Clean Demo Code

The starter ships with a "skills" CRUD demo across all three tiers. Remove it to get a clean skeleton:

```bash
bun run clean-demo
```

> **Deprecated:** `bun run clean-demo` and `bun run bootstrap` are deprecated. Use `tbs scaffold init` instead.

## Local Development

```bash
# API server only
bun run dev:server

# Web app only (expects the API server on localhost:3000)
bun run dev:web

# Both together
bun run dev:all
```

Notes:

- `bun run dev:web` starts Astro on `http://localhost:4321`
- During web development, `/api/*` is proxied to `http://localhost:3000`
- `bun run dev:all` is the simplest way to use the web dashboard against the local API
- To serve the built web app from the Bun server on port `3000`, run
  `bun run build:web && bun run dev:server`

### Try the CLI Demo

```bash
bun run dev:cli -- skill create --name "my-skill" --json
bun run dev:cli -- skill list --json
bun run dev:cli -- skill get --id <id> --json
bun run dev:cli -- skill delete --id <id> --json
```

### Try the API Demo

```bash
bun run dev:server
# http://localhost:3000/api/skills
# http://localhost:3000/api/health  (JSON health envelope)
# http://localhost:3000/            (simple health JSON)
# http://localhost:3000/swagger    (Swagger UI)
# http://localhost:3000/doc        (OpenAPI JSON)
```

### Try the Web Demo

```bash
bun run dev:all
# http://localhost:4321/
# http://localhost:4321/dashboard
```

The dashboard includes a `Check Healthy` button that calls the shared web API client,
hits `/api/health` through the Astro dev proxy, and renders the typed health payload.

## Removing Optional Tiers

### Keep CLI + API, remove the web app

```bash
rm -rf apps/web

bun --eval 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); delete pkg.scripts["dev:web"]; delete pkg.scripts["build:web"]; delete pkg.scripts["dev:all"]; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

bun run check
```

Optional cleanup:

- Remove the static serving block from `apps/server/src/index.ts` if you want a pure API server
- Remove web-related notes from your own project docs once you decide the web tier is gone

### Keep CLI only, remove the API and web tiers

```bash
rm -rf apps/server apps/web

bun --eval 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); delete pkg.scripts["dev:server"]; delete pkg.scripts["dev:web"]; delete pkg.scripts["dev:all"]; delete pkg.scripts["build:web"]; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

bun run check
```

### Keep the web app but remove the local API

That is possible, but the current web demo assumes a backend is available at `/api`.
If you want to keep `apps/web` and remove `apps/server`, do this first:

1. Set `PUBLIC_API_URL` to your external backend
2. Update `apps/web/src/pages/dashboard.astro` if you do not want the local `Check Healthy` demo
3. Remove `dev:server` and `dev:all` from `package.json`

## Adding a New Domain

Follow the pattern established by the "skills" example, or run `bun run clean-demo`
first and build your own domain from scratch:

1. **Schema** -- `packages/core/src/db/schema.ts` (add table)
2. **Validation** -- `packages/core/src/schemas/my-domain.ts` (Zod + `.openapi()`)
3. **Service** -- `packages/core/src/services/my-service.ts` (CRUD with `Result<T>`)
4. **Export** -- `packages/core/src/index.ts` (barrel export)
5. **CLI** -- `apps/cli/src/commands/my-*.ts` (4 commands: create, list, get, delete)
6. **API** -- `apps/server/src/routes/my-domain.ts` (OpenAPI routes)
7. **Web (optional)** -- `apps/web/src/pages/`, `apps/web/src/components/`, and
   `apps/web/src/lib/api-client.ts`
8. **Tests** -- `tests/` at package root (in-memory SQLite for unit tests)

## Commands

```bash
bun run check          # lint + typecheck + test (pre-commit gate)
bun run test           # full suite with coverage
bun run format         # biome format
bun run lint-fix       # biome lint --write
bun run typecheck      # tsc --noEmit
bun run db:push        # push schema to dev database
bun run db:generate    # generate migration files
bun run dev:cli        # run CLI in dev mode
bun run dev:server     # run API with hot reload
bun run dev:web        # run Astro web app on localhost:4321
bun run dev:all        # run API + web together for local development
bun run build:web      # build Astro web app into apps/web/dist
bun run build:cli      # compile CLI to standalone binary
bun run pub2npmjs      # publish to npm

# Scaffold commands (see "Scaffold Commands" section above)
tbs scaffold init      # initialize or update project identity
tbs scaffold add       # install an optional feature
tbs scaffold remove    # uninstall an optional feature
tbs scaffold list      # show all features with status
tbs scaffold validate  # validate project contracts
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Language | TypeScript (strict, no `any`) |
| Database | SQLite via Drizzle ORM (bun:sqlite or Cloudflare D1) |
| Validation | Zod (`@hono/zod-openapi`) |
| CLI | Clipanion |
| API | Hono + OpenAPI |
| Web | Astro 5 + React islands + Tailwind CSS v4 |
| Lint/Format | Biome |
| Logging | LogTape |

## Documentation

- [Architecture Spec](docs/01_ARCHITECTURE_SPEC.md) -- full system design and ADRs
- [Developer Spec](docs/02_DEVELOPER_SPEC.md) -- implementation patterns and conventions
- [Existing Project Migration Guide](docs/existing-project-migration-guide.md) -- AI-assisted migration model for adopting starter capabilities into existing repos
- [User Manual](docs/03_USER_MANUAL.md) -- CLI and API reference

## License

Apache 2.0
