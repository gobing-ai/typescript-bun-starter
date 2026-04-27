# User Manual: TypeScript Bun Starter (TBS)

> End-user documentation for project initialization, scaffold commands, migration workflow, policy enforcement, and observability.

## 1. Quick Start

### 1.1 New Project from Starter

```bash
bunx degit gobing-ai/typescript-bun-starter my-project && cd my-project
bun install
bun run scaffold:init -- --name my-project --scope @acme --title "My Project"
bun run check
```

### 1.2 First Commands

After initialization, verify the project is healthy:

```bash
bun run check               # lint, typecheck, tests, contract validation
bun run smoke:generated     # full generated-project verification
```

### 1.3 From Compiled Binary

```bash
bun run build:cli
./dist/tbs scaffold init --name my-project --scope @acme --title "My Project"
```

## 2. Project Profiles

Choose a profile, then trim to match:

| Profile | Included workspaces | How to reach it |
| --- | --- | --- |
| CLI + API + Web | `apps/cli`, `apps/server`, `apps/web` | Default checkout |
| CLI + API | `apps/cli`, `apps/server` | `bun run scaffold:remove -- webapp` |
| CLI only | `apps/cli` | Remove `webapp`, then `server` |

The CLI tier is always present — it owns the project-shaping workflow.

## 3. Scaffold CLI Reference

The scaffold CLI (`tbs`) manages project identity, workspace composition, and contract validation.

```bash
# Development (via Bun)
bun run dev:cli -- scaffold <command>

# Compiled binary
./tbs scaffold <command>
```

### 3.1 Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help for any command |
| `--json` | Machine-readable JSON output (for AI agents and CI) |
| `--dry-run` | Preview changes without applying |

### 3.2 Commands

#### `scaffold init`

Initialize or update project identity. Rewrites package names, internal imports, generated instruction files, CLI metadata, and starter-facing copy.

```bash
tbs scaffold init --name <slug> --scope <scope> [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | Yes | Project slug (kebab-case, used in package names) |
| `--scope` | Yes | npm scope (e.g., `@myorg`) |
| `--title` | No | Display name (Title Case, defaults to name) |
| `--brand` | No | Short brand name for CLI binary label |
| `--bin` | No | Binary name (defaults to `tbs`) |
| `--repo-url` | No | Repository URL |
| `--skip-check` | No | Skip post-init verification |
| `--dry-run` | No | Preview without applying |
| `--json` | No | JSON output mode |

#### `scaffold add`

Install an optional feature workspace.

```bash
tbs scaffold add <feature> [--dry-run] [--json]
```

| Feature | Description |
|---------|-------------|
| `server` | Hono REST API server with Swagger UI |
| `webapp` | Astro 6 web application with React islands |
| `cli` | Scaffold CLI (required, always present) |

#### `scaffold remove`

Uninstall an optional feature workspace.

```bash
tbs scaffold remove <feature> [--dry-run] [--json]
```

Removes the workspace folder, its dependency entries, and stale references in docs and scripts.

#### `scaffold list`

Show all features with their installation status.

```bash
tbs scaffold list [--json]
```

#### `scaffold validate`

Validate project contract integrity against `contracts/project-contracts.json`.

```bash
tbs scaffold validate [--fix] [--dry-run] [--json]
```

| Option | Description |
|--------|-------------|
| `--fix` | Automatically fix fixable issues |
| `--dry-run` | Preview fixes without applying |
| `--json` | JSON output mode |

### 3.3 Agent Mode (`--json`)

All scaffold commands support `--json` for machine-readable output. Designed for:

- **AI coding agents** consuming output programmatically
- **Shell scripts** piping data between commands
- **CI/CD pipelines** integrating scaffold validation

```bash
# Check project state programmatically
tbs scaffold validate --json
tbs scaffold list --json

# Dry-run before applying
tbs scaffold remove webapp --dry-run --json
```

### 3.4 Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (validation failure, missing workspace, etc.) |

## 4. Migration Workflow

Migrate an existing project to adopt starter patterns incrementally.

### 4.1 Install as dev dependency

```bash
cd /path/to/existing-project
bun add @gobing-ai/typescript-bun-starter --dev
```

### 4.2 Analyze differences

```bash
bun run migrate:analyze -- \
  --source node_modules/@gobing-ai/typescript-bun-starter \
  --target .
```

Produces a migration plan showing what files differ and suggested actions.

Interactive mode:

```bash
bun run migrate:analyze -- \
  --source node_modules/@gobing-ai/typescript-bun-starter \
  --target . \
  --interactive
```

### 4.3 Apply migration

```bash
bun run migrate:apply -- --plan migration-plan.json
```

### 4.4 Clean up

```bash
bun remove @gobing-ai/typescript-bun-starter
```

For detailed strategies (pattern adoption, core-first extraction, fresh starter plus port-in), see the [Existing Project Migration Guide](docs/existing-project-migration-guide.md).

## 5. API Reference

### 5.1 Starting the Server

```bash
# Development
bun run dev:server

# Production
bun run apps/server/src/index.ts
```

Default port: `3000`. Override with `PORT` env var.

### 5.2 Authentication

When `API_KEY` is set, all `/api/*` endpoints require authentication via the `X-API-Key` header.

```bash
# With auth
API_KEY=sk-secret bun run dev:server
curl -H "X-API-Key: sk-secret" http://localhost:3000/api/skills

# Dev mode (no auth)
unset API_KEY
curl http://localhost:3000/api/skills
```

### 5.3 Endpoints

#### `GET /api/skills`

List all skills. Supports pagination via `?limit=N&offset=M`.

```bash
curl http://localhost:3000/api/skills
curl "http://localhost:3000/api/skills?limit=10&offset=0"
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "name": "web-search",
      "description": "Search the web",
      "version": 1,
      "config": null,
      "createdAt": 1712345678000,
      "updatedAt": 1712345678000
    }
  ]
}
```

#### `POST /api/skills`

Create a new skill.

```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{"name": "web-search"}'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name (1-100 characters) |

**Response (201):**

```json
{ "data": { "name": "web-search" } }
```

#### `GET /api/skills/:id`

Get a skill by ID.

```bash
curl http://localhost:3000/api/skills/abc-123
```

**Response (404):**

```json
{ "error": "Skill not found: nonexistent" }
```

#### `DELETE /api/skills/:id`

Delete a skill by ID.

```bash
curl -X DELETE http://localhost:3000/api/skills/abc-123
```

**Response (200):**

```json
{ "data": null }
```

### 5.4 OpenAPI Documentation

| URL | Description |
|-----|-------------|
| `http://localhost:3000/doc` | OpenAPI 3.0 JSON specification |
| `http://localhost:3000/swagger` | Swagger UI (interactive) |

The OpenAPI spec can be imported into Postman, used as OpenAI custom actions, or consumed as Claude MCP tool definitions.

### 5.5 Health Check

```bash
curl http://localhost:3000/
# → {"status":"ok","timestamp":"2026-04-27T..."}

curl http://localhost:3000/api/health
# → {"data":{"status":"ok","timestamp":"2026-04-27T..."}}
```

## 6. Configuration

### 6.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `data/app.db` | SQLite database file path |
| `API_KEY` | *(none)* | API authentication key. If unset, auth is disabled |
| `PORT` | `3000` | Server listen port |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `TELEMETRY_ENABLED` | `false` | Enable OpenTelemetry tracing and metrics |
| `OTEL_SERVICE_NAME` | *(none)* | Service name in trace exports |
| `OTEL_ENVIRONMENT` | *(none)* | Environment label in trace exports |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | *(none)* | OTLP HTTP endpoint for trace/metric export |

### 6.2 Database

Default: SQLite file at `data/app.db`, created automatically on first use.

```bash
# Custom path
DATABASE_URL=/path/to/custom.db bun run dev:server

# Push schema changes after code changes
bun run db:push
```

The `data/` directory is gitignored. For Cloudflare D1 deployments, see the [Database Access Guide](docs/05_DATABASE_ACCESS.md).

## 7. Policy Enforcement

The repository ships with a reusable policy driver that enforces code conventions.

### 7.1 Run policies

```bash
bun run check:policy          # run all policies
bun run check:policy --fix    # auto-fix where possible
```

Run a specific policy:

```bash
bun run scripts/policy-check.ts --policy db-boundaries
```

### 7.2 Covered policies

| Policy | What it enforces |
|--------|-----------------|
| `bun-only` | No npm/pnpm/yarn references |
| `bun-test` | Tests use `bun:test`, not Jest or Vitest |
| `db-boundaries` | No Drizzle imports outside DB infrastructure |
| `logger` | No `console.*` in scripts or app code |
| `output-boundaries` | Output goes through `echo/echoError` |
| `external-api-boundaries` | API calls use shared HTTP client wrappers |
| `git-safety` | No hardcoded secrets or force-push patterns |

### 7.3 Fix modes

The policy driver supports two fix actions:

- **`rewrite`** — replaces matching text in affected files (e.g., `console.log` → `logger.info`)
- **`command`** — runs a shell command to fix the issue (e.g., `bun remove jest`)

Full details in the [Policy Check Guide](docs/06_POLICY_CHECK.md).

## 8. Observability

### 8.1 Enable telemetry

```bash
export TELEMETRY_ENABLED=true
export OTEL_SERVICE_NAME=my-service
export OTEL_ENVIRONMENT=development
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Runtime modes:

| `TELEMETRY_ENABLED` | `OTEL_EXPORTER_OTLP_ENDPOINT` set? | Behavior |
|---|---|---|
| `false` | — | No telemetry; server runs normally |
| `true` | No | Spans/metrics created in-process, no remote export |
| `true` | Yes | Traces and metrics exported to collector/backend |

### 8.2 Local observability stack

```bash
# Bring up OTel Collector + Jaeger
bun run dev:observability

# Enable telemetry and start the server
export TELEMETRY_ENABLED=true
export OTEL_SERVICE_NAME=my-service
export OTEL_ENVIRONMENT=development
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
bun run dev:server

# Open Jaeger UI
open http://localhost:16686
```

Useful commands:

```bash
bun run dev:observability         # start stack
bun run dev:observability:logs    # tail collector logs
bun run dev:observability:down    # stop stack
```

### 8.3 Emit custom spans

```ts
import { traceAsync, addSpanAttributes, addSpanEvent } from '@starter/core';

const result = await traceAsync('my-operation', async (span) => {
  span.setAttribute('my.key', 'value');
  addSpanAttributes({ 'app.operation': 'my-operation' });
  addSpanEvent('my-operation.started', { 'my.key': 'value' });
  return await doWork();
});
```

### 8.4 Server metrics

The server auto-instruments three metric surfaces:

- **Inbound HTTP**: request count, duration histogram, error count
- **Outbound HTTP** (via `fetchApi()`): request count, duration, errors
- **DB operations** (via DAO instrumentation): operation count, duration, errors

All metrics are exported through the OTLP HTTP exporter when configured.

## 9. CLI Binary Build

```bash
# Local platform
bun run build:cli
# Output: dist/tbs

# Cross-compile
bun build --compile --target=bun-linux-x64 apps/cli/src/index.ts --outfile dist/tbs-linux
bun build --compile --target=bun-darwin-arm64 apps/cli/src/index.ts --outfile dist/tbs-macos
```

The binary includes the Bun runtime — no installation required on the target machine.

## 10. Docker Deployment

```dockerfile
FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile --production

COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/server apps/server

EXPOSE 3000
CMD ["bun", "run", "apps/server/src/index.ts"]
```

```bash
docker build -t typescript-bun-starter .
docker run -p 3000:3000 -e API_KEY=sk-secret typescript-bun-starter
```

## 11. Daily Development Commands

```bash
bun install                     # install dependencies
bun run check                   # full gate: lint, typecheck, tests, contract, docs
bun run check:policy            # policy enforcement only
bun run test                    # test suite with coverage
bun run typecheck               # TypeScript type checking
bun run format                  # Biome format
bun run lint-fix                # Biome lint with auto-fix
bun run dev:cli                 # CLI development
bun run dev:server              # API server development (port 3000)
bun run dev:web                 # Web app development (port 4321)
bun run dev:all                 # Server + Web together
bun run db:push                 # Push Drizzle schema to SQLite
```

## 12. Troubleshooting

### `{"error":"Unauthorized"}`

`API_KEY` is set but you didn't provide a valid key. Either:

- Pass the key: `curl -H "X-API-Key: your-key" ...`
- Unset `API_KEY` for local development (auth is disabled when not set).

### Database not found / empty

The database is created automatically on first use. If data is missing:

- Check `DATABASE_URL` points to the correct file
- Run `bun run db:push` to ensure the schema is up to date

### Scaffold validate fails

The project contract is out of sync. Common causes:

- Workspace added/removed manually without `scaffold add/remove`
- File naming doesn't match contract patterns
- Required root scripts are missing

Fix: `bun run scaffold:validate -- --fix` or re-run the appropriate scaffold command.

### `bun run check` fails on docs

Canonical docs contain stale or missing content. Run `bun run check:docs` to see specific failures. Update the affected doc to match the current codebase.
