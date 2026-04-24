# TypeScript Bun Starter

Bun-first monorepo starter and scaffold CLI for building **CLI**, **CLI + API**, or **CLI + API + Web**
projects with strict TypeScript, shared contracts, and a generated-project workflow exercised in CI.

## What It Is

- **Primary product:** a starter repo you copy, initialize, and trim to the profile you want
- **Secondary product:** a scaffold CLI you can compile into a standalone `tbs` binary later
- **Architectural spine:** `@starter/contracts` for transport-safe types and `@starter/core` for shared logic,
  persistence, logging, and adapters

## Repo Map

- **`packages/contracts`**: shared DTOs, API envelopes, and transport-safe contracts
- **`packages/core`**: database adapters, Drizzle schema, logging helpers, and core business logic
- **`apps/cli`**: the scaffold CLI built with Clipanion
- **`apps/server`**: Hono API with Swagger UI and optional static serving of the built web app
- **`apps/web`**: Astro 5 web app with React islands, Tailwind CSS v4, and a typed API client
- **`scripts/scaffold/templates/webapp`**: scaffold source for restoring the web tier after removal

## Starter Profiles

Choose a profile, then use scaffold commands to keep the repo contract aligned:

| Profile | Included workspaces | Typical command |
| --- | --- | --- |
| CLI + API + Web | `apps/cli`, `apps/server`, `apps/web` | default checkout |
| CLI + API | `apps/cli`, `apps/server` | `bun run scaffold:remove -- webapp` |
| CLI only | `apps/cli` | `bun run scaffold:remove -- webapp` then `bun run scaffold:remove -- server` |

## Quick Start

### Use as a starter repo

```bash
bunx degit gobing-ai/typescript-bun-starter my-project && cd my-project
bun install
bun run scaffold:init -- --name my-project --scope @acme --title "My Project"
bun run check
```

### Use as a compiled CLI later

```bash
bun run build:cli
./dist/tbs scaffold init --name my-project --scope @acme --title "My Project"
```

## Local Development

```bash
bun run dev:cli
bun run dev:server
bun run dev:web
bun run dev:all
```

## Verification

```bash
bun run check
bun run smoke:generated
```

- `bun run check` runs format/lint checks, scaffold validation, docs validation, typecheck, and tests
- `bun run smoke:generated` copies the repo into a temp project and exercises the full-stack, CLI + API, and CLI-only generated profiles

## Telemetry

The starter includes a shared OpenTelemetry helper layer in `@starter/core` for server-side tracing.

### Enable it

Set the standard OpenTelemetry env vars before starting the server:

```bash
export TELEMETRY_ENABLED=true
export OTEL_SERVICE_NAME=my-service
export OTEL_ENVIRONMENT=development
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

`apps/server/src/index.ts` initializes telemetry during server bootstrap. If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, the server still runs normally and no remote trace export is attempted.

Runtime modes:

- `TELEMETRY_ENABLED=false`
  - telemetry is disabled and the server runs normally
- `TELEMETRY_ENABLED=true` with no `OTEL_EXPORTER_OTLP_ENDPOINT`
  - spans can still be created in-process, but nothing is exported remotely
- `TELEMETRY_ENABLED=true` with `OTEL_EXPORTER_OTLP_ENDPOINT` set
  - traces are exported when a collector/backend is available

The observability stack is optional. You can run the server directly without OpenTelemetry services and enable the collector/Jaeger stack only when you need trace inspection.

### Local observability stack

For local tracing during development or manual testing, bring up the bundled collector + Jaeger stack:

```bash
bun run dev:observability
export TELEMETRY_ENABLED=true
export OTEL_SERVICE_NAME=my-service
export OTEL_ENVIRONMENT=development
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Then start the server and open Jaeger at `http://localhost:16686`.

Useful commands:

```bash
bun run dev:observability
bun run dev:observability:logs
bun run dev:observability:down
```

The compose stack lives under `dockers/` and routes OTLP traffic through the OpenTelemetry Collector into Jaeger.

### Emit custom spans

Application code should import telemetry helpers from `@starter/core`, not from `@opentelemetry/*` directly.

```ts
import { addSpanAttributes, addSpanEvent, traceAsync } from '@starter/core';

const skill = await traceAsync('skills.create', async (span) => {
    span.setAttribute('skill.name', input.name);
    addSpanAttributes({ 'app.operation': 'skills.create' });
    addSpanEvent('skills.create.requested', { 'skill.name': input.name });
    return await skillsDao.createSkill(input);
});
```

Use `traceAsync()` for most application work. Reach for lower-level tracer APIs only when the shared helpers are not sufficient.

## Documentation

- [Architecture Spec](docs/01_ARCHITECTURE_SPEC.md)
- [Developer Spec](docs/02_DEVELOPER_SPEC.md)
- [Scaffold Guide](docs/04_SCAFFOLD_GUIDE.md)
- [Existing Project Migration Guide](docs/existing-project-migration-guide.md)

## References

- [Bun workspaces](https://bun.sh/docs/pm/workspaces)
- [Install Bun in GitHub Actions](https://bun.sh/docs/guides/install/cicd)
