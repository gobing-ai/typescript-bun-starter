# AGENTS.md -- `apps/cli`

Transport layer for `@starter/core`. Built on `commander` + `@commander-js/extra-typings` (same major version in lockstep).

## Command Pattern

**Wiring** lives in one file: `src/commands/<domain>/index.ts`. All `.command()`, `.option()`, `.action()` chains go here.

**Actions** are zero-framework pure functions in `scaffold-<verb>.ts`:

```typescript
export interface InitActionOpts { name?: string; ... }
export async function scaffoldInitAction(
    opts: InitActionOpts,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): Promise<void> { /* sets process.exitCode, never calls process.exit() */ }
```

**Wiring calls the action:**

```typescript
scaffold.command('init')
    .option('--name <slug>', '...')
    .action(async (opts) => { await scaffoldInitAction(opts, out, err); });
```

**Stream injection:** `out`/`err` default to `process` in production, replaced by mock writables in tests via `buildTestProgram()`.

**Shared output:** `src/ui/output.ts` — `writeOutput(out, err, isJson, data, error?)`, `writeSuccess(out, isJson, msg)`, `formatDryRunPreview(files, action)`.

## Structure

```
src/
├── index.ts                  # figlet banner, logger, program.parseAsync()
├── config.ts
├── ui/{output,prompts,readline}.ts
└── commands/scaffold/
    ├── index.ts              # ALL commander wiring
    ├── scaffold-{init,add,remove,list,validate}.ts  # action + helpers (no commander imports)
    ├── features/registry.ts
    ├── services/scaffold-service.ts
    └── types/scaffold.ts
```

## Testing

- Unit: call module-level functions directly
- Integration: `buildTestProgram()` from `tests/helpers/test-program.ts` + `program.parseAsync()`
- New commands: action function file + wiring entry in index.ts — no exceptions
