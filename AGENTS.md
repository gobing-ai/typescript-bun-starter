# AGENTS.md — TypeScript Bun Starter

## Test Directory Convention

All unit tests MUST use **co-located `tests/` at the package root**, NOT `__tests__/` inside `src/`.

**Why:** Keeps `src/` clean, scales well in monorepos, and test structure mirrors source structure without interleaving.

### Directory Layout

```
packages/core/
  src/
    services/skill-service.ts
    db/adapter.ts
  tests/
    services/skill-service.test.ts
    db/adapter.test.ts
apps/cli/
  src/
    commands/skill-create.ts
  tests/
    commands/skill-create.test.ts
apps/server/
  src/
    routes/skills.ts
    middleware/auth.ts
  tests/
    routes/skills.test.ts
    middleware/auth.test.ts
```

### Rules

- **NEVER** use `__tests__/` directories inside `src/`
- **NEVER** place `.test.ts` files alongside source files in `src/`
- Test files go in `tests/` at the workspace root, mirroring the `src/` directory structure
- Import paths from tests to source use `../../src/...` (or appropriate depth)

## No `any` Types

**NEVER** use `// biome-ignore lint/suspicious/noExplicitAny` to suppress the `any` lint rule.

**Why:** Defeats the purpose of type safety. Fix the code instead.

### Alternatives

| Situation | Instead of `any` | Use |
|-----------|-------------------|-----|
| Accessing internal APIs | `(x as any).prop` | `Reflect.get(x, "prop")` |
| Mock objects for third-party types | `mock as any` | `mock as unknown as TargetType` |
| Hono handler return types | `Promise<any>` | Remove explicit annotation, let TS infer from `c.json()` |
| Test utilities overriding context | `context = { ... } as any` | Use the library's native context parameter |

## Tech Stack

- **Runtime:** Bun.js
- **Language:** TypeScript (strict mode)
- **Linter/Formatter:** Biome v2.x
- **ORM:** Drizzle ORM with sqlite-core schemas
- **Framework:** Hono + @hono/zod-openapi
- **CLI:** Clipanion 4.0.0-rc.4
- **Logger:** LogTape

## Commands

```bash
bun run check         # lint + typecheck + test with coverage gate
bun run test          # full test suite with lcov + coverage gate
bun run typecheck     # tsc --noEmit
bun run format        # biome format --write
bun run lint-fix      # biome lint --write
```

## Coverage Gate

Per-file line coverage >= 90%. Configured in `scripts/check-coverage.ts`.
