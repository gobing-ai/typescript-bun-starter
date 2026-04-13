# TypeScript Bun Starter

A production-ready monorepo starter for building **CLI**, **CLI + API**, or **CLI + API + Web** projects with TypeScript and Bun.

## What You Get

- **`packages/core`** -- Shared business logic, database layer (Drizzle ORM + SQLite), validation (Zod), and services
- **`apps/cli`** -- Type-safe CLI via Clipanion with dual-mode output (human + `--json`)
- **`apps/server`** -- REST API with auto-generated OpenAPI docs (Hono + Swagger UI)
- **Biome** for linting/formatting, **LogTape** for logging, **strict TypeScript** throughout

The project ships with a working "skills" CRUD example across all three tiers. Replace it with your own domain.

## Quick Start

```bash
# via degit (recommended — clean copy, no git history)
bunx degit gobing-ai/typescript-bun-starter my-project && cd my-project
bun install
bun run check        # lint + typecheck + test (all should pass)

# or clone from GitHub
git clone https://github.com/gobing-ai/typescript-bun-starter.git my-project && cd my-project
bun install
bun run check
```

> **npm package:** [`@gobing-ai/typescript-bun-starter`](https://www.npmjs.com/package/@gobing-ai/typescript-bun-starter)

### Clean Demo Code

The starter ships with a "skills" CRUD demo across all three tiers. Remove it to get a clean skeleton:

```bash
bun run clean-demo
```

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
# http://localhost:3000/swagger    (Swagger UI)
# http://localhost:3000/doc        (OpenAPI JSON)
```

## Customization Guide

### Tier 1: CLI Only

If you only need a CLI tool, ignore `apps/server/` entirely.

1. **Define your database schema** in `packages/core/src/db/schema.ts`
2. **Write Zod schemas** in `packages/core/src/schemas/` (validation + OpenAPI metadata)
3. **Build your service** in `packages/core/src/services/` (returns `Result<T>` for typed errors)
4. **Add CLI commands** in `apps/cli/src/commands/` (each command is a Clipanion class)
5. **Register commands** in `apps/cli/src/index.ts`

```typescript
// apps/cli/src/commands/my-command.ts
import { Command, Option } from "clipanion";

export class MyCommand extends Command {
  constructor() { super(); }

  static paths = [["my", "command"]];
  json = Option.Boolean("--json", false, {});

  async execute() {
    const service = new MyService();
    const result = await service.doSomething();
    if (!result.ok) {
      this.context.stderr.write(`Error: ${result.error.message}\n`);
      return 1;
    }
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(result.data)}\n`);
    } else {
      this.context.stdout.write(`Done!\n`);
    }
    return 0;
  }
}
```

Compile to a standalone binary:

```bash
bun run build:cli    # outputs dist/tbs
```

### Tier 2: CLI + API

Add routes in `apps/server/src/routes/` using `@hono/zod-openapi`:

```typescript
// apps/server/src/routes/my-route.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MyService, mySelectSchema } from "@project/core";

const app = new OpenAPIHono();
const service = new MyService();

const listRoute = createRoute({
  method: "get",
  path: "/items",
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ data: z.array(mySelectSchema) }) } },
      description: "List items",
    },
  },
});

app.openapi(listRoute, async (c) => {
  const result = await service.list();
  if (!result.ok) return c.json({ error: result.error.message }, 500);
  return c.json({ data: result.data }, 200);
});

export default app;
```

Mount in `apps/server/src/index.ts`:

```typescript
app.route("/api", myRoutes);
```

### Tier 3: CLI + API + Web

Add Hono JSX views in `apps/server/src/views/` and enable JSX in `apps/server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

## Adding a New Domain

Follow the pattern established by the "skills" example (or run `bun run clean-demo` first, then build from scratch):

1. **Schema** -- `packages/core/src/db/schema.ts` (add table)
2. **Validation** -- `packages/core/src/schemas/my-domain.ts` (Zod + `.openapi()`)
3. **Service** -- `packages/core/src/services/my-service.ts` (CRUD with `Result<T>`)
4. **Export** -- `packages/core/src/index.ts` (barrel export)
5. **CLI** -- `apps/cli/src/commands/my-*.ts` (4 commands: create, list, get, delete)
6. **API** -- `apps/server/src/routes/my-domain.ts` (OpenAPI routes)
7. **Tests** -- `tests/` at package root (in-memory SQLite for unit tests)

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
bun run build:cli      # compile CLI to standalone binary
bun run clean-demo     # remove "skills" demo code, leaving clean skeleton
bun run pub2npmjs      # publish to npm
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
| Lint/Format | Biome |
| Logging | LogTape |

## Documentation

- [Architecture Spec](docs/01_ARCHITECTURE_SPEC.md) -- full system design and ADRs
- [Developer Spec](docs/02_DEVELOPER_SPEC.md) -- implementation patterns and conventions
- [User Manual](docs/03_USER_MANUAL.md) -- CLI and API reference

## License

Apache 2.0
