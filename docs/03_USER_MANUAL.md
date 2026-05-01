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
curl -H "X-API-Key: sk-secret" http://localhost:3000/api/health

# Dev mode (no auth)
unset API_KEY
curl http://localhost:3000/api/health
```

### 5.3 Endpoints

#### `GET /`

Root health check (no auth required).

```bash
curl http://localhost:3000/
# → {"status":"ok","timestamp":"2026-04-29T..."}
```

#### `GET /api/health`

API health check with envelope response (no auth required).

```bash
curl http://localhost:3000/api/health
# → {"code":0,"message":"ok","result":"success","data":{"status":"ok","timestamp":"..."}}
```

#### `GET /api/health/queue`

Queue health check — returns job counts by status (no auth required).

```bash
curl http://localhost:3000/api/health/queue
# → {"code":0,"message":"ok","result":"success","data":{"pending":5,"processing":1,"completed":42,"failed":2}}
```

Useful for monitoring async job processing pipelines. The queue consumer (`DBQueueConsumer`) manages these
status transitions; the endpoint is a read-only window into queue health.

### 5.4 OpenAPI Documentation

| URL | Description |
|-----|-------------|
| `http://localhost:3000/doc` | OpenAPI 3.0 JSON specification |
| `http://localhost:3000/swagger` | Swagger UI (interactive) |

The OpenAPI spec can be imported into Postman, used as OpenAI custom actions, or consumed as Claude MCP tool definitions.

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
```

The `data/` directory is gitignored. For full architecture details, see the [Database Access Guide](docs/05_DATABASE_ACCESS.md).

#### Defining Table Schemas

Table definitions live in `packages/core/src/db/schema/`. Each domain gets its own file.

```ts
// packages/core/src/db/schema/users.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { standardColumns } from './common';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    ...standardColumns,  // adds createdAt + updatedAt
});
```

Re-export from the barrel:

```ts
// packages/core/src/db/schema/index.ts
export * from './common';
export * from './queue-jobs';
export * from './users';   // ← add this
```

Column helpers:

| Helper | Columns |
|--------|---------|
| `standardColumns` | `createdAt`, `updatedAt` (integer ms) |
| `standardColumnsWithSoftDelete` | `createdAt`, `updatedAt`, `inUsed` (1=active, 0=deleted) |

#### Creating a DAO

DAOs extend `EntityDao` for generic CRUD and add domain-specific methods:

```ts
// packages/core/src/db/users-dao.ts
import type { DbClient } from './adapter';
import { EntityDao } from './entity-dao';
import { users } from './schema';

export class UsersDao extends EntityDao<typeof users, typeof users.id> {
    constructor(db: DbClient) {
        super(db, users, users.id, 'users');
    }

    async findByEmail(email: string) {
        return this.findBy(users.email, email);
    }
}
```

`EntityDao` provides: `create`, `findById`, `findAll`, `findBy`, `findAllBy`, `update`, `delete`, `list`, `count`.

Use DAOs in server handlers:

```ts
import type { DbClient } from '@starter/core';
import { UsersDao } from '@starter/core';

const dao = new UsersDao(db);
const user = await dao.findByEmail('alice@example.com');
```

#### Database Migration Commands

| Command | Purpose |
|---------|---------|
| `bun run db:push` | Rapid dev — push schema changes directly to DB |
| `bun run db:generate` | Generate versioned migration SQL files |
| `bun run db:migrate` | Apply generated migrations to the database |
| `bun run db:check-drift` | Verify schema and migrations are in sync |
| `bun run db <cmd>` | Pass-through to drizzle-kit (`studio`, `check`, `drop`, etc.) |

**Development workflow:**

```bash
# Option A: Rapid iteration (no migration files)
bun run db:push

# Option B: Production-ready (commit migrations)
bun run db:generate      # creates drizzle/NNNN_name.sql
bun run db:migrate        # applies to local DB
git add drizzle/          # commit migration files
```

**Automatic migrations at startup:**

```bash
AUTO_MIGRATE=1 bun run dev:server
```

When `AUTO_MIGRATE=1`, the server applies pending migrations before serving requests. Only works with bun:sqlite. Default: off.

**CI drift detection:**

`bun run check` includes `db:check-drift` which verifies the schema matches the migration files. If you add a table but forget to run `db:generate`, CI will fail with instructions.

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

## 11. Cloudflare Deployment

The project supports Cloudflare Workers (API server) and Cloudflare Pages (web app) as first-class deployment targets.

### 11.1 Prerequisites

```bash
# Install Wrangler CLI (already a devDependency — no extra install needed)
# Authenticate with Cloudflare
npx wrangler login

# Create D1 database (one-time)
npx wrangler d1 create starter-db
# → Copy the database_id from output into apps/server/wrangler.toml

# Create KV namespace for sessions (one-time)
npx wrangler kv:namespace create SESSION
# → Copy the id into apps/server/wrangler.toml
```

### 11.2 Deploy the API Server (Workers)

```bash
# 1. Edit apps/server/wrangler.toml — replace placeholder IDs
#    - [[d1_databases]].database_id
#    - [[kv_namespaces]].id

# 2. Deploy
bun run deploy:server

# 3. Local dev with Miniflare (simulates D1 + KV locally)
bun run dev:server:cf
```

The server runs as a Cloudflare Worker. The `APP_MODE=cloudflare` env var selects the Cloudflare scheduler adapter (registry pattern). `APP_MODE=node` (default) uses in-process `node-cron`.

### 11.3 Deploy the Web App (Pages)

```bash
# Build and deploy as static site
bun run deploy:web

# Preview locally with Pages dev server
bun run preview:web:cf
```

The web app deploys as a static site. The `astro.config.mjs` is pre-configured with `@astrojs/cloudflare`.

**Switching to SSR on Pages Functions:**

```js
// apps/web/astro.config.mjs
export default defineConfig({
-    output: 'static',
+    output: 'server',
     adapter: cloudflare({ ... }),
});
```

When `output: 'server'`, the Astro CF adapter auto-generates a Worker `wrangler.json` in `dist/server/`. Add any required D1/KV bindings to `apps/web/wrangler.toml` and deploy.

### 11.4 Environment-Specific Configuration

`wrangler.toml` supports `[env.staging]` and `[env.production]` sections. Each can override the Worker name, D1 database, and KV namespace:

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Deploy to production
npx wrangler deploy --env production
```

### 11.5 Secrets Management

Use Wrangler secrets for sensitive values (API keys, tokens):

```bash
npx wrangler secret put API_KEY
# → Enter the secret value at the prompt
```

Do NOT hardcode secrets in `wrangler.toml` — the policy driver enforces this.

## 12. Scheduled Jobs (Cron)

The starter ships with a cross-environment scheduler abstraction. Jobs are registered once; the runtime selects the correct adapter automatically.

### 12.1 Architecture

| Environment | Adapter | How it works |
|-------------|---------|-------------|
| Node.js / VPS | `NodeSchedulerAdapter` | In-process `node-cron` — runs jobs inside the Bun process |
| Cloudflare Workers | `CloudflareSchedulerAdapter` | Registry pattern — `scheduled(event)` handler dispatches by cron expression |
| Disabled | `NoOpSchedulerAdapter` | Tracks job names for introspection, never executes |

Selection is automatic via `APP_MODE` env var (default: `node`).

### 12.2 Registering a Cron Job

Add your job to `apps/server/src/scheduled.ts`:

```ts
// apps/server/src/scheduled.ts
import { getScheduler } from './scheduled';

getScheduler().then((scheduler) => {
    scheduler.register({
        name: 'daily-cleanup',
        schedule: '0 0 * * *',        // midnight UTC
        timezone: 'UTC',               // optional, defaults to UTC
        handler: async (scheduledTime, cron) => {
            // Your cleanup logic here
            console.log('Running daily cleanup');
        },
    });
});
```

### 12.3 Cloudflare Cron Triggers

For Cloudflare Workers, match each cron expression to a `[[triggers]]` entry in `apps/server/wrangler.toml`:

```toml
# apps/server/wrangler.toml
[[triggers]]
crons = ["0 0 * * *"]
```

The Worker runtime calls `scheduled(event)` automatically. The adapter finds the matching job by `event.cron`.

### 12.4 Node.js (node-cron)

No extra config needed. Set `APP_MODE=node` (or leave it unset) and jobs run in-process via `node-cron`. Start the server normally:

```bash
bun run dev:server
```

The scheduler starts automatically when the module loads.

### 12.5 Disabling the Scheduler

```bash
SCHEDULER_ENABLED=false bun run dev:server
```

Useful for stateless deployments, tests, or environments where cron is handled externally.

## 13. Daily Development Commands

```bash
bun install                     # install dependencies
bun run check                   # full gate: lint, typecheck, tests, contract, docs, drift
bun run check:policy            # policy enforcement only
bun run test                    # test suite with coverage
bun run typecheck               # TypeScript type checking
bun run format                  # Biome format
bun run lint-fix                # Biome lint with auto-fix
bun run dev:cli                 # CLI development
bun run dev:server              # API server development (port 3000)
bun run dev:web                 # Web app development (port 4321)
bun run dev:all                 # Server + Web together
bun run db:push                 # Push schema to SQLite (rapid dev)
bun run db:generate             # Generate migration SQL files
bun run db:migrate              # Apply migrations
bun run db:check-drift          # Verify schema/migration sync
bun run db studio               # Visual database inspector
```

## 14. Troubleshooting

### `{"error":"Unauthorized"}`

`API_KEY` is set but you didn't provide a valid key. Either:

- Pass the key: `curl -H "X-API-Key: your-key" ...`
- Unset `API_KEY` for local development (auth is disabled when not set).

### Database not found / empty

The database is created automatically on first use. If data is missing:

- Check `DATABASE_URL` points to the correct file
- Run `bun run db:push` to ensure the schema is up to date
- Run `bun run db:check-drift` to verify migrations match the schema

### Scaffold validate fails

The project contract is out of sync. Common causes:

- Workspace added/removed manually without `scaffold add/remove`
- File naming doesn't match contract patterns
- Required root scripts are missing

Fix: `bun run scaffold:validate -- --fix` or re-run the appropriate scaffold command.

### `bun run check` fails on docs

Canonical docs contain stale or missing content. Run `bun run check:docs` to see specific failures. Update the affected doc to match the current codebase.
