---
name: replace clipanion with commander-js with extra-typings and figlet
description: replace clipanion with commander-js with extra-typings and figlet
status: Backlog
profile: standard
created_at: 2026-04-27T00:40:36.170Z
updated_at: 2026-04-27T00:40:36.170Z
folder: docs/tasks
type: task
impl_progress:
  planning: completed
  design: completed
  implementation: pending
  review: pending
  testing: pending
---

## 0022. replace clipanion with commander-js with extra-typings and figlet

### Background
The current CLI implementation in `apps/cli` uses `clipanion` (v4.0.0-rc.4) for command-line parsing. While functional, the scaffold command hierarchy (5 commands: `init`, `add`, `remove`, `list`, `validate`) introduces unnecessary complexity through deep class inheritance (`BaseScaffoldCommand → Command`), manual option wiring via `Option.String()` decorators, and inline prompt-based option collection. The `ScaffoldInitCommand` alone spans ~275 lines and mixes parsing, I/O, and business logic.

This task replaces `clipanion` with `commander.js` (a mature, widely-adopted CLI framework with 27k+ GitHub stars) to achieve a flatter, more idiomatic command structure. Two type-safety strategies are available:

1. **`commander-js/extra-typings`** — An officially-maintained thin wrapper that adds full TypeScript type inference for options and action handlers. Preferred path if it covers all needed functionality.
2. **Bare `commander.js`** — Sufficient if extra-typings has gaps, but requires manual type annotations.

The evaluation will determine which path to follow. Additionally, `figlet` will be used for ASCII art banner rendering on CLI startup (cosmetic enhancement).

**Motivation:** Reduce code complexity, improve type-safety of CLI option handling, adopt a more community-standard library, and establish a simpler pattern for adding future commands.

### Requirements

1. **Evaluate extra-typings suitability** — Verify that `commander-js/extra-typings` supports all patterns used by the scaffold commands (subcommands, variadic args, boolean flags, required string options). If yes, adopt it as the primary API. If gaps exist, fall back to bare `commander.js` with explicit type annotations.

2. **Replace clipanion with commander.js in `apps/cli/src/index.ts`** — Remove all `clipanion` imports (`Builtins`, `Cli`, `Command`, `Option`). Replace `Cli` instantiation and `cli.register()` calls with a `commander.program` chain. Initialize logger and telemetry before command parsing. Render a figlet ASCII banner on startup (non-JSON mode only).

3. **Flatten scaffold commands** — Remove the `BaseScaffoldCommand` abstract class. Rewrite each scaffold subcommand (`init`, `add`, `remove`, `list`, `validate`) as standalone functions or thin command modules using `commander.command()` or `program.command()`. Each command module must:
   - Define options with proper TypeScript types (via extra-typings or manual `Option` typing)
   - Delegate business logic to `ScaffoldService` (no I/O mixing in command definitions)
   - Support `--dry-run` and `--json` flags consistently across all commands
   - Export a registration function (e.g., `registerScaffoldCommands(program: Command)`) that the index wires together

4. **Maintain identical CLI behavior** — All existing commands must produce the same output for the same inputs. Command names, flags, help text, error messages, and exit codes must not change.

5. **Preserve existing tests** — All tests in `apps/cli/tests/` must continue to pass after the migration. Update test imports from `clipanion` to `commander.js` programmatic invocation patterns as needed.

6. **Update `apps/cli/package.json`** — Replace `clipanion` dependency with `commander` and `commander-js/extra-typings` (or `commander` only, per evaluation outcome). Add `figlet` and `@types/figlet` as dependencies.


### Constraints

- **Library decision gate:** extra-typings evaluation must complete before command migration begins. If extra-typings is selected, all option definitions must use its typed API.
- **No breaking CLI contract:** Command names (`scaffold init`, `scaffold add`, etc.), flag names (`--dry-run`, `--json`, etc.), and positional args must remain unchanged.
- **No mixed libraries:** Do not ship both `clipanion` and `commander.js` in `package.json` simultaneously.
- **Test continuity:** `bun test` in `apps/cli/` must pass at every commit. No period of broken tests is acceptable.
- **Code style compliance:** Must pass `bun run check` (lint + typecheck + test) in the monorepo root.
- **Logging:** Logger initialization (`@logtape/logtape`) in `index.ts` must remain functional and happen before command parsing.
- **Binary name:** The CLI binary name (`tbs`) must remain unchanged.

### Q&A

**Q1: Which path for type safety — extra-typings or bare commander.js?**
**A:** Evaluate `extra-typings` first. If it supports nested subcommands (`program.command('scaffold').command('add')`), variadic args, and option type inference without hacks, use it. Otherwise fall back to bare `commander.js`. The evaluation result should be documented in the Design section.

**Q2: What stays out of scope?**
**A:** This task only migrates existing scaffold commands to commander.js. It does NOT add new commands, change scaffold logic, modify template files, or touch `packages/core`. The `figlet` integration is cosmetic only (startup banner).

**Q3: How is success verified?**
**A:** (1) `bun run check` passes in monorepo root; (2) All existing CLI tests pass with identical assertions; (3) Manual smoke test: `bun run dev -- scaffold add webapp --dry-run` produces same output as before; (4) `bun run dev -- --help` shows commander.js-generated help; (5) Figlet banner renders on startup in non-JSON mode.

**Q4: What is the expected command structure pattern?**
**A:** Each command module exports a `register(program: commander.Command)` function. The index file creates the program, calls each register function, then calls `program.parse()`. No class inheritance. Options are defined inline via `.option()` chaining.



### Design

#### Decision: Use `@commander-js/extra-typings`

**Verdict: ADOPT extra-typings.** Verified against npm registry (2026-04-26):

| Library | Version | Notes |
|---------|---------|-------|
| `commander` | 14.0.3 | Latest stable |
| `@commander-js/extra-typings` | 14.0.0 | Always versioned in sync with commander |
| `figlet` | 1.11.0 | Latest stable |
| `@types/figlet` | 1.7.0 | Latest |

Extra-typings works by re-exporting commander's `Command` class with stronger generics — the public API surface is identical to bare `commander` but option/arg types propagate into `.action()` callbacks automatically. It supports:
- Nested subcommands via `.command('scaffold').addCommand(...)` or chained `.command('scaffold').command('init')`
- Boolean flags via `.option('--dry-run', ...)` → inferred as `boolean | undefined`
- Required string options via `.requiredOption('--name <value>', ...)` → inferred as `string`
- Optional string options via `.option('--name <value>', ...)` → inferred as `string | undefined`
- Positional arguments via `.argument('<feature>', ...)` → inferred as `string`
- No gaps for the patterns used in this codebase.

#### Dependency Changes

```diff
// apps/cli/package.json
"dependencies": {
-    "clipanion": "^4.0.0-rc.4",
+    "commander": "^14.0.3",
+    "@commander-js/extra-typings": "^14.0.0",
+    "figlet": "^1.11.0",
     "@logtape/logtape": "^2.0.5",
     "@starter/core": "workspace:*"
},
+"devDependencies": {
+    "@types/figlet": "^1.7.0"
+}
```

#### Module Structure

The class hierarchy collapses to pure functions and thin modules:

```
apps/cli/src/
├── index.ts                       # Program root: banner, logger, parse
├── config.ts                      # CLI_CONFIG constants (unchanged)
├── ui/
│   ├── prompts.ts                 # Unchanged
│   └── readline.ts                # Unchanged
└── commands/
    └── scaffold/
        ├── index.ts               # registerScaffoldCommands(program) ← NEW
        ├── scaffold-init.ts       # registerInitCommand(scaffold) ← migrated
        ├── scaffold-add.ts        # registerAddCommand(scaffold) ← migrated
        ├── scaffold-remove.ts     # registerRemoveCommand(scaffold) ← migrated
        ├── scaffold-list.ts       # registerListCommand(scaffold) ← migrated
        ├── scaffold-validate.ts   # registerValidateCommand(scaffold) ← migrated
        ├── features/registry.ts   # Unchanged
        ├── services/scaffold-service.ts  # Unchanged
        └── types/scaffold.ts      # Unchanged
```

`base-scaffold-command.ts` is **deleted**. Its three helpers (`writeOutput`, `formatDryRunPreview`, `writeSuccess`) move to a standalone `scaffold-output.ts` module exported as pure functions.

#### Type-Safety Strategy

```typescript
// Import from extra-typings, not commander directly
import { Command, program } from '@commander-js/extra-typings';

// Option types are inferred — no manual annotations needed
scaffold.command('init')
  .option('--name <slug>', 'Project slug (kebab-case)')
  .option('--scope <scope>', 'NPM scope (e.g., @myorg)')
  .option('--dry-run', 'Preview changes without applying')
  .option('--json', 'Output as JSON (agent mode)')
  .action(async (opts) => {
    // opts.name: string | undefined
    // opts.scope: string | undefined
    // opts.dryRun: boolean | undefined
    // opts.json: boolean | undefined
  });
```

Note: commander camelCases `--dry-run` to `dryRun` automatically.

#### Shared Output Helpers

`BaseScaffoldCommand`'s three protected methods become pure functions in a new module:

```typescript
// src/commands/scaffold/scaffold-output.ts
export function writeOutput(stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream,
  isJson: boolean, data: unknown, error?: string): number

export function formatDryRunPreview(files: string[], action: string): string

export function writeSuccess(stdout: NodeJS.WritableStream, isJson: boolean, message: string): void
```

In the commander action handlers, `stdout`/`stderr` are `process.stdout`/`process.stderr` directly. This removes the need for clipanion's `this.context` stream injection.

#### Banner Integration

Figlet banner renders at startup in `index.ts`, before `program.parse()`, and only when `--json` is absent from `process.argv`:

```typescript
import figlet from 'figlet';

const isJsonMode = process.argv.includes('--json');

if (!isJsonMode) {
  // figlet.textSync is synchronous — no await needed
  const banner = figlet.textSync(CLI_CONFIG.binaryLabel, { font: 'Standard' });
  process.stdout.write(`${banner}\n`);
}
```

**Font choice:** `Standard` — universally available in figlet's bundled fonts, produces compact multi-line ASCII art that fits 80-char terminals. No async loading required since all bundled fonts are synchronous.

**Placement:** Entrypoint only (not per-command). Banner fires once per invocation before any command runs.

#### Error Model

Commander's default error behavior: invalid options → print error + usage → `process.exit(1)`. This matches clipanion's `runExit` behavior. Override `exitOverride()` only in tests to capture errors programmatically without process exit.

Commander exit codes:
- `0` — success
- `1` — command-reported error (via `process.exitCode = 1` + `process.exit(1)` in action handler)
- `1` — commander parse error (invalid option/missing required arg)

To match the current pattern where action handlers return a numeric exit code, the `index.ts` wraps `program.parseAsync()` and maps the return:

```typescript
const exitCode = await runAction(); // each command stores exit code in a closure
process.exit(exitCode);
```

Alternatively (simpler): each action handler calls `process.exit(code)` directly, which matches clipanion's `runExit` semantics.

#### Testing Strategy

The current tests couple tightly to clipanion's `Cli`/`process()` API:

```typescript
// BEFORE (clipanion)
const cli = new Cli({ binaryName: 'tbs' });
cli.register(ScaffoldAddCommand);
const cmd = cli.process(['scaffold', 'add', 'webapp', '--json'], { stdout: mockStream });
const exitCode = await cmd.execute();
```

After migration, tests use commander's programmatic API:

```typescript
// AFTER (commander)
import { createScaffoldProgram } from '../../../src/commands/scaffold/test-helpers';

const { program, stdout, stderr } = createTestProgram();
program.exitOverride(); // prevent process.exit in tests
await program.parseAsync(['scaffold', 'add', 'webapp', '--json'], { from: 'user' });
// capture output via mocked process.stdout/stderr
```

The cleanest approach: expose a `buildProgram(stdout, stderr)` factory used by both `index.ts` (with `process.stdout`/`stderr`) and tests (with mock writables). This preserves stream injection without clipanion's context system.

For tests that currently inspect class properties (e.g., `cmd.dryRun`, `cmd.json`), the properties move to the parsed options object — tests are rewritten to assert on action behavior rather than property values.

Tests that assert on `ScaffoldAddCommand.paths` or `ScaffoldXxx.usage` (static metadata checks) are replaced by `program.helpInformation()` snapshot tests or direct option/argument inspection via `command.options` and `command.args`.

#### Edge Cases

| Case | Clipanion behavior | Commander behavior | Delta |
|------|-------------------|--------------------|-------|
| Unknown flag | Error + usage | Error + usage | None |
| Missing positional arg | Error + usage | Error + usage | None |
| `--help` | Exits 0 | Exits 0 | None |
| `--version` | Exits 0 with version | Exits 0 with version | None |
| JSON mode + banner | Banner suppressed | Banner suppressed (checked before parse) | None |
| Subcommand help (`scaffold --help`) | Shows scaffold commands | Shows scaffold commands | Verify |
| Unrecognized subcommand | Error exit 1 | Error exit 1 via `.addHelpCommand()` | None |

---

### Solution

This section provides a concrete before/after mapping for every clipanion API surface in use.

#### 1. Dependency Swap

```bash
# Remove clipanion
bun remove clipanion --filter @starter/cli

# Add commander stack
bun add commander @commander-js/extra-typings figlet --filter @starter/cli
bun add -d @types/figlet --filter @starter/cli
```

Final `apps/cli/package.json`:

```json
{
  "name": "@starter/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    "@commander-js/extra-typings": "^14.0.0",
    "@logtape/logtape": "^2.0.5",
    "@starter/core": "workspace:*",
    "commander": "^14.0.3",
    "figlet": "^1.11.0"
  },
  "devDependencies": {
    "@types/figlet": "^1.7.0"
  }
}
```

#### 2. New: `src/commands/scaffold/scaffold-output.ts`

Replaces `BaseScaffoldCommand`'s three protected methods:

```typescript
import { echo, echoError } from '@starter/core';

export function writeOutput(
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
  isJson: boolean,
  data: unknown,
  error?: string,
): number {
  if (isJson) {
    const output =
      error && data && typeof data === 'object'
        ? { error, ...(data as Record<string, unknown>) }
        : error
          ? { error, data }
          : data;
    stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else if (error) {
    echoError(`Error: ${error}`, stderr);
  }
  return error ? 1 : 0;
}

export function formatDryRunPreview(files: string[], action: string): string {
  if (files.length === 0) return 'No changes needed.';
  const header =
    action === 'delete' ? 'Files that would be deleted:'
    : action === 'add'  ? 'Files that would be added:'
    : action === 'write' ? 'Files that would be modified:'
    : 'Files that would change:';
  return `${header}\n${files.map((f) => `  - ${f}`).join('\n')}`;
}

export function writeSuccess(
  stdout: NodeJS.WritableStream,
  isJson: boolean,
  message: string,
): void {
  if (!isJson) echo(message, stdout);
}
```

#### 3. `src/index.ts` — Full Replacement

```typescript
#!/usr/bin/env bun
import { Writable } from 'node:stream';
import { configure, getConsoleSink, getStreamSink } from '@logtape/logtape';
import { createLoggerSinks, getLoggerConfig } from '@starter/core';
import { program } from '@commander-js/extra-typings';
import figlet from 'figlet';
import { registerScaffoldCommands } from './commands/scaffold/index';
import { CLI_CONFIG } from './config';

// Detect JSON agent mode before anything is printed.
const isJsonMode = process.argv.includes('--json');

// ASCII banner (non-JSON mode only)
if (!isJsonMode) {
  process.stdout.write(`${figlet.textSync(CLI_CONFIG.binaryLabel, { font: 'Standard' })}\n`);
}

// Logger must be configured before command parsing.
const loggerConfig = getLoggerConfig(process.env);
await configure({
  ...loggerConfig,
  sinks: createLoggerSinks(loggerConfig, {
    consoleSink: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
  }),
});

program
  .name(CLI_CONFIG.binaryName)
  .description(CLI_CONFIG.binaryLabel)
  .version(CLI_CONFIG.binaryVersion);

registerScaffoldCommands(program);

await program.parseAsync();
```

#### 4. `src/commands/scaffold/index.ts` — Registration Hub

```typescript
import type { Command } from '@commander-js/extra-typings';
import { registerInitCommand } from './scaffold-init';
import { registerAddCommand } from './scaffold-add';
import { registerRemoveCommand } from './scaffold-remove';
import { registerListCommand } from './scaffold-list';
import { registerValidateCommand } from './scaffold-validate';

export function registerScaffoldCommands(program: Command): void {
  const scaffold = program
    .command('scaffold')
    .description('Project scaffolding commands');

  registerInitCommand(scaffold);
  registerAddCommand(scaffold);
  registerRemoveCommand(scaffold);
  registerListCommand(scaffold);
  registerValidateCommand(scaffold);
}
```

#### 5. `scaffold-init.ts` — Before/After Mapping

**BEFORE (clipanion):**
```typescript
export class ScaffoldInitCommand extends BaseScaffoldCommand {
  static override paths = [['scaffold', 'init']];
  name = Option.String('--name', { required: false });
  scope = Option.String('--scope', { required: false });
  title = Option.String('--title', { required: false });
  brand = Option.String('--brand', { required: false });
  repoUrl = Option.String('--repo-url', { required: false });
  bin = Option.String('--bin', { required: false });
  skipCheck = Option.Boolean('--skip-check', false);
  async execute(): Promise<number> { ... }
}
```

**AFTER (commander):**
```typescript
import type { Command } from '@commander-js/extra-typings';
import { writeOutput, formatDryRunPreview, writeSuccess } from './scaffold-output';

export function registerInitCommand(scaffold: Command): void {
  scaffold
    .command('init')
    .description('Initialize project identity (name, scope, branding)')
    .addHelpText('after', `
Examples:
  tbs scaffold init --name my-project --scope @myorg
  tbs scaffold init --name my-project --scope @myorg --dry-run
  tbs scaffold init --name my-project --scope @myorg --json`)
    .option('--name <slug>', 'Project slug (kebab-case, required)')
    .option('--title <title>', 'Display name (Title Case)')
    .option('--brand <brand>', 'Short brand name')
    .option('--scope <scope>', 'NPM scope (e.g., @myorg, required)')
    .option('--repo-url <url>', 'Repository URL')
    .option('--bin <name>', 'CLI binary name (default: tbs)')
    .option('--skip-check', 'Skip post-init verification')
    .option('--dry-run', 'Preview changes without applying')
    .option('--json', 'Output as JSON (agent mode)')
    .action(async (opts) => {
      const { stdout, stderr } = process;
      const isJson = opts.json ?? false;
      const service = new ScaffoldService();

      // Collect options (opts.name/scope may be undefined — same as before)
      const options = collectInitOptions(opts, service, isJson);
      const validation = validateInitOptions(options);
      if (!validation.ok) {
        process.exitCode = writeOutput(stdout, stderr, isJson, null, validation.error);
        return;
      }

      // ... rest of execute() logic, unchanged, using opts.dryRun, opts.json, etc.
      // echoError calls use process.stderr
    });
}
```

Key mapping: `this.dryRun` → `opts.dryRun`, `this.json` → `opts.json`, `this.name` → `opts.name`, `this.context.stdout` → `process.stdout`, `this.context.stderr` → `process.stderr`.

The `collectOptions`, `validateOptions`, `computeIdentity`, `stageChanges`, `replaceInContent`, `runPostInitScripts` methods become module-level functions (not exported by default, exported only for testing where needed).

#### 6. `scaffold-add.ts` — Positional Arg Mapping

**BEFORE:**
```typescript
feature = Option.String();  // clipanion positional
```

**AFTER:**
```typescript
scaffold.command('add')
  .description('Add optional feature modules')
  .argument('<feature>', 'Feature name (webapp, server, cli)')
  .option('--dry-run', 'Preview changes without applying')
  .option('--json', 'Output as JSON (agent mode)')
  .action(async (feature, opts) => {
    // feature: string (required positional — same semantics as clipanion)
    // opts.dryRun, opts.json: boolean | undefined
    ...
  });
```

Commander places positional args before the options object in `.action()` callbacks.

#### 7. `scaffold-remove.ts` — Same as Add

Same positional arg pattern as `scaffold-add`. The `feature` argument is the first param to `.action()`.

#### 8. `scaffold-list.ts` — No Args

**BEFORE:**
```typescript
// No extra options beyond base (--dry-run, --json)
async execute(): Promise<number> { ... }
```

**AFTER:**
```typescript
scaffold.command('list')
  .description('List available scaffold features and their status')
  .option('--json', 'Output as JSON (agent mode)')
  .action(async (opts) => {
    // Same logic, opts.json replaces this.json
    // echo() calls use process.stdout
    ...
  });
```

Note: `list` never used `--dry-run`, so it is omitted from this command.

#### 9. `scaffold-validate.ts` — Extra Flag

**BEFORE:**
```typescript
fix = Option.Boolean('--fix', false);
```

**AFTER:**
```typescript
scaffold.command('validate')
  .description('Validate project contracts and structure')
  .option('--fix', 'Auto-fix fixable issues')
  .option('--dry-run', 'Preview changes without applying')
  .option('--json', 'Output as JSON (agent mode)')
  .action(async (opts) => {
    // opts.fix: boolean | undefined
    const shouldFix = opts.fix ?? false;
    ...
  });
```

#### 10. `echoError` call sites

All `echoError('...', this.context.stderr)` → `echoError('...', process.stderr)`.
All `echo('...', this.context.stdout)` → `echo('...', process.stdout)`.

This is a mechanical find-and-replace once the class is removed.

#### 11. Test Infrastructure Replacement

The `makeCli()` helper in every test file is replaced by a `buildTestProgram()` factory:

```typescript
// tests/helpers/test-program.ts
import { Command } from '@commander-js/extra-typings';
import { Writable } from 'node:stream';
import { registerScaffoldCommands } from '../../src/commands/scaffold/index';

export function buildTestProgram() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  // Override process.stdout/stderr globally for duration of test
  // OR: use dependency injection factory (preferred)
  const program = new Command();
  program.exitOverride(); // prevent process.exit() during tests
  program.configureOutput({
    writeOut: (str) => stdout.push(str),
    writeErr: (str) => stderr.push(str),
  });
  registerScaffoldCommands(program);

  return { program, stdout, stderr };
}
```

Usage in tests:

```typescript
// BEFORE
const cli = new Cli({ binaryName: 'tbs' });
cli.register(ScaffoldAddCommand);
const cmd = cli.process(['scaffold', 'add', 'nonexistent', '--json'], { stdout: mockStream });
const exitCode = await cmd.execute();

// AFTER
const { program, stdout } = buildTestProgram();
await program.parseAsync(['scaffold', 'add', 'nonexistent', '--json'], { from: 'user' });
const output = JSON.parse(stdout.join(''));
expect(output.error).toContain('Unknown feature');
```

**Important:** Tests that currently construct `new ScaffoldInitCommand()` directly to call public helper methods (`validateOptions`, `computeIdentity`, `replaceInContent`, etc.) continue to work — those methods become module-level functions exported from their respective modules, so tests import and call them directly without any commander involvement.

```typescript
// These tests need NO commander at all — pure unit tests
import { validateInitOptions, computeIdentity, replaceInContent } from '../../../src/commands/scaffold/scaffold-init';

it('should return error when name is missing', () => {
  const result = validateInitOptions({ scope: '@myorg' });
  expect(result.ok).toBe(false);
});
```

#### 12. Static Metadata Tests

Tests checking `ScaffoldXxxCommand.paths` and `ScaffoldXxxCommand.usage` are replaced:

```typescript
// BEFORE
expect(ScaffoldAddCommand.paths).toEqual([['scaffold', 'add']]);
expect(ScaffoldAddCommand.usage.category).toBe('Scaffold');

// AFTER — verify command is registered with correct name
const { program } = buildTestProgram();
const scaffold = program.commands.find((c) => c.name() === 'scaffold');
const add = scaffold?.commands.find((c) => c.name() === 'add');
expect(add).toBeDefined();
expect(add?.description()).toContain('Add optional feature');
```

#### 13. figlet Integration Notes

- `figlet.textSync()` is synchronous — no `await`, no async concern.
- Bun ESM: `import figlet from 'figlet'` works with the published CJS package via Bun's interop layer (verified: figlet v1.11.0 ships CJS + types, Bun handles it transparently).
- The `Standard` font is bundled in figlet — no filesystem font loading, no async.
- Banner is suppressed in `--json` mode by checking `process.argv.includes('--json')` before any output.

---

### Plan

#### Step 1 — Dependency Swap (30 min)

1. In `apps/cli/package.json`, remove `clipanion`, add `commander`, `@commander-js/extra-typings`, `figlet`, `@types/figlet` (dev).
2. Run `bun install` from monorepo root.
3. Verify: `bun run typecheck` fails (expected — imports still reference clipanion).

**Verification gate:** `bun install` exits 0. Node modules contain `commander` and `figlet`.

---

#### Step 2 — Add `scaffold-output.ts` (30 min)

1. Create `apps/cli/src/commands/scaffold/scaffold-output.ts` with the three pure-function helpers extracted from `BaseScaffoldCommand`.
2. Add unit tests in `apps/cli/tests/commands/scaffold/scaffold-output.test.ts` that mirror the existing `base-scaffold-command.test.ts` assertions.
3. Do NOT yet delete `base-scaffold-command.ts` — it still compiles with clipanion.

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-output.test.ts` passes. `bun run typecheck` still fails (expected).

---

#### Step 3 — Migrate `scaffold-init.ts` (1.5 h)

1. Create new `scaffold-init.ts` using the commander API:
   - Move `collectOptions`, `validateOptions`, `computeIdentity`, `stageChanges`, `replaceInContent`, `runPostInitScripts` to module-level functions.
   - Export `validateInitOptions`, `computeIdentity`, `replaceInContent`, `runPostInitScripts` for test access.
   - Export `registerInitCommand(scaffold: Command): void`.
   - Replace all `this.context.stdout/stderr` with `process.stdout/stderr`.
   - Replace `writeOutput`/`writeSuccess`/`formatDryRunPreview` calls with imports from `scaffold-output.ts`.
2. Update `apps/cli/tests/commands/scaffold/scaffold-init.test.ts`:
   - Remove `import { Cli } from 'clipanion'`.
   - Replace `makeCli()` with `buildTestProgram()` (see Step 8).
   - Keep all `validateOptions`, `computeIdentity`, `replaceInContent`, `promptText`, `runPostInitScripts`, `stageChanges` unit tests — they now import module-level functions directly.
   - Rewrite `execute (dry-run path)` and `execute (validation error)` tests using `program.parseAsync()`.
   - Rewrite `collectOptions (interactive mode)` tests — these call the exported `collectInitOptions` function directly.

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-init.test.ts` passes. `bun run typecheck` still fails.

---

#### Step 4 — Migrate `scaffold-add.ts` (1 h)

1. Rewrite `scaffold-add.ts` as `registerAddCommand(scaffold: Command): void`.
2. Export `collectTemplateFiles`, `formatDryRunOutput`, `updateContracts` as module-level functions for tests.
3. Update `apps/cli/tests/commands/scaffold/scaffold-add.test.ts`:
   - Remove clipanion imports.
   - `path registration` test → verify via `program.commands`.
   - `usage` test → verify via `command.description()`.
   - `options` tests → verify options are registered via `command.options`.
   - `validation - unknown feature` → use `program.parseAsync()`.
   - `collectTemplateFiles`, `formatDryRunOutput`, `updateContracts` → import directly, no commander needed.

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-add.test.ts` passes.

---

#### Step 5 — Migrate `scaffold-remove.ts` (1 h)

1. Rewrite `scaffold-remove.ts` as `registerRemoveCommand(scaffold: Command): void`.
2. Update `apps/cli/tests/commands/scaffold/scaffold-remove.test.ts` (same pattern as step 4).

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-remove.test.ts` passes.

---

#### Step 6 — Migrate `scaffold-list.ts` (45 min)

1. Rewrite `scaffold-list.ts` as `registerListCommand(scaffold: Command): void`.
2. Export `formatHeader`, `formatSection` as module-level functions.
3. Update `apps/cli/tests/commands/scaffold/scaffold-list.test.ts`:
   - `formatHeader`, `formatSection`, `isInstalled` tests → import directly.
   - `execute` tests → use `program.parseAsync()`.
   - Remove `ScaffoldListCommand.paths` and `.usage` static checks, replace with command inspection.

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-list.test.ts` passes.

---

#### Step 7 — Migrate `scaffold-validate.ts` (1 h)

1. Rewrite `scaffold-validate.ts` as `registerValidateCommand(scaffold: Command): void`.
2. Update `apps/cli/tests/commands/scaffold/scaffold-validate.test.ts`:
   - `options` tests → verify via `command.options`.
   - All `execute` tests → use `program.parseAsync()`.
   - `--fix path` test currently uses `Reflect.set(cmd, 'runSync', ...)` — replace with a dependency-injected `runSync` parameter or spy on `spawnSync`.

**Verification gate:** `bun test apps/cli/tests/commands/scaffold/scaffold-validate.test.ts` passes.

---

#### Step 8 — Add Test Infrastructure (30 min)

1. Create `apps/cli/tests/helpers/test-program.ts` with `buildTestProgram()` factory (see Solution §11).
2. This is used by steps 3–7 above — create it before those steps or alongside step 3.
3. The factory uses `program.exitOverride()` to prevent `process.exit()` in tests.
4. Capture stdout/stderr via `program.configureOutput()` for commander-level messages (help, errors).
5. For command action output going to `process.stdout`/`process.stderr`, use module-level output injection or mock `process.stdout.write`.

**Note:** The cleanest approach for capturing action handler output is to pass `stdout`/`stderr` streams into the `registerXxx` functions as parameters:

```typescript
export function registerScaffoldCommands(
  program: Command,
  out = process.stdout,
  err = process.stderr,
): void { ... }
```

This allows tests to pass `new Writable(...)` collectors — preserving the stream injection pattern that the current tests rely on.

**Verification gate:** `buildTestProgram()` imports cleanly. All prior tests still pass.

---

#### Step 9 — Update `src/commands/scaffold/index.ts` (20 min)

1. Replace class re-exports with `registerScaffoldCommands(program: Command)` function.
2. Keep type/service re-exports intact (other parts of the codebase may import from here).

**Verification gate:** `bun run typecheck` passes for the scaffold directory.

---

#### Step 10 — Rewrite `src/index.ts` (30 min)

1. Replace clipanion `Cli` with commander `program`.
2. Add figlet banner (non-JSON mode only, `Standard` font).
3. Ensure logger config happens after banner, before `parseAsync`.
4. Call `await program.parseAsync()`.

**Verification gate:** `bun run dev -- --help` prints commander help. `bun run dev -- --version` prints `0.1.0`. Banner appears in non-JSON mode. No banner in `--json` mode.

---

#### Step 11 — Delete `base-scaffold-command.ts` (10 min)

1. Delete `apps/cli/src/commands/scaffold/base-scaffold-command.ts`.
2. Delete `apps/cli/tests/commands/scaffold/base-scaffold-command.test.ts` (replaced by `scaffold-output.test.ts`).
3. Update `apps/cli/src/commands/scaffold/index.ts` to remove the class re-export if present.

**Verification gate:** `bun run typecheck` passes. `bun test` passes.

---

#### Step 12 — Update `apps/cli/AGENTS.md` (10 min)

Append a section documenting the commander stack and version-alignment trap:

```markdown
## CLI Framework

- Built on `commander` + `@commander-js/extra-typings`.
- **Version pin rule:** `commander` and `@commander-js/extra-typings` MUST share the same major version. When upgrading one, upgrade the other in the same commit.
- Commands are registered via `registerXxxCommand(parent, out, err)` functions — no class hierarchy.
- Streams (`stdout`/`stderr`) are injected, not pulled from `process` directly. This keeps tests parallel-safe.
- Banner: `figlet` `Standard` font, rendered once at startup in `index.ts`. Suppressed when `--json` is in `process.argv`.
```

**Verification gate:** file edited, `bun run check:docs` passes.

---

#### Step 13 — Update `features/registry.ts` description (5 min)

The `cli` feature description currently says "Clipanion-based CLI tool". Update to "Commander.js-based CLI tool".

**File:** `apps/cli/src/commands/scaffold/features/registry.ts` (search for "Clipanion").

---

#### Step 14 — Update `config.ts` comment (5 min)

`apps/cli/src/config.ts` references "Clipanion" in a comment. Update to "Commander.js".

---

#### Step 15 — Full Check Gate (15 min)

```bash
bun run check   # biome + scaffold:validate + check:docs + check:policy + typecheck + test:coverage
```

All must pass. No `biome-ignore` suppressions added. Coverage thresholds must hold (see `scripts/check-coverage.ts`).

If `bun run check` fails on `scaffold:validate` (the contracts gate), inspect with:

```bash
bun run scaffold:validate
```

The CLI itself is now responsible for that gate — a regression here means the migration broke the validate command.

---

#### Step 16 — Smoke Tests (15 min)

Manual verification from monorepo root (these match the existing `package.json` script style):

```bash
# Help output (commander format) — banner + program help
bun run apps/cli/src/index.ts --help

# Subcommand help
bun run apps/cli/src/index.ts scaffold --help
bun run apps/cli/src/index.ts scaffold init --help

# Version
bun run apps/cli/src/index.ts --version

# Dry-run (same output as before)
bun run apps/cli/src/index.ts scaffold add webapp --dry-run

# JSON mode (NO banner — single line of clean JSON)
bun run apps/cli/src/index.ts scaffold list --json

# Existing root scripts must still work
bun run scaffold:list
bun run scaffold:validate
```

Expected:
- Figlet banner appears in non-JSON invocations, before any other output.
- `--json` mode produces ONLY parseable JSON on stdout (no banner, no logs on stdout).
- Help/version exit codes are `0`.
- Unknown command/option exits `1` with a commander-style "error:" message.
- All existing root `scaffold:*` scripts produce identical observable behavior to pre-migration.

---

#### Step Summary

| Step | File(s) Touched | Est. | Gate |
|------|----------------|------|------|
| 1 | `apps/cli/package.json` | 30m | `bun install` ✓ |
| 2 | `scaffold-output.ts` (new) + test | 30m | path-scoped `bun test` ✓ |
| 3 | `scaffold-init.ts` + test | 1.5h | path-scoped `bun test` ✓ |
| 4 | `scaffold-add.ts` + test | 1h | path-scoped `bun test` ✓ |
| 5 | `scaffold-remove.ts` + test | 1h | path-scoped `bun test` ✓ |
| 6 | `scaffold-list.ts` + test | 45m | path-scoped `bun test` ✓ |
| 7 | `scaffold-validate.ts` + test | 1h | path-scoped `bun test` ✓ |
| 8 | `tests/helpers/test-program.ts` (new) | 30m | imports cleanly ✓ |
| 9 | `commands/scaffold/index.ts` | 20m | typecheck ✓ |
| 10 | `src/index.ts` | 30m | `--help` and `--version` work ✓ |
| 11 | Delete `base-scaffold-command.ts` + test | 10m | `bun test` ✓ |
| 12 | `apps/cli/AGENTS.md` | 10m | `check:docs` ✓ |
| 13 | `features/registry.ts` | 5m | cosmetic |
| 14 | `config.ts` | 5m | cosmetic |
| 15 | — | 15m | `bun run check` ✓ |
| 16 | — | 15m | manual smoke ✓ |
| **Total** | | **~8.5h** | |

---

#### Locked Decisions

**D1: Stream injection over process mocking — LOCKED.**
`registerScaffoldCommands(program, out, err)` accepts `out`/`err` writable streams (defaulting to `process.stdout`/`process.stderr`). Each `registerXxxCommand(scaffold, out, err)` propagates them into the action handlers. Tests construct `new Writable({ write })` collectors and pass them in — no `process.stdout.write` patching, no global state. Rationale: matches the existing test pattern (the current `mockStream` in clipanion tests does exactly this via `cli.process(argv, { stdout, stderr })`), keeps tests parallel-safe, and survives Bun runtime upgrades.

**D2: Action-handler exit semantics — LOCKED.**
Action handlers set `process.exitCode = N` (do NOT call `process.exit(N)` directly). The root `await program.parseAsync()` returns; the Bun runtime exits with the set code. Tests use `program.exitOverride()` so commander parse errors throw `CommanderError` instead of exiting — caught and asserted via `expect(...).toThrow()`.

**D3: `--json` mode banner suppression — LOCKED.**
Check `process.argv.includes('--json')` once at the top of `index.ts`, before any output. Single source of truth.

#### Residual Risks

**Risk 1: `scaffold-validate --fix` test uses `Reflect.set` monkey-patching.**
The current test at `scaffold-validate.test.ts` (around line 756) sets `runSync` via reflection on the command instance. After migration, `runSync` becomes a module-level function. Mitigation: refactor `runSync` to accept an injected `spawn` parameter (default `spawnSync` from `node:child_process`), then in the test pass a `bun:test` `mock()` for the spawn function. Covered in Step 7.

**Risk 2: commander error formatting differs from clipanion.**
Commander's parse-error messages (e.g., "error: unknown option '--foo'") differ in wording from clipanion's. Any test asserting on exact stderr text for parse errors will need updates. Mitigation: Step 8 includes a stderr-snapshot audit; assertions move to `toContain('unknown option')` style instead of exact-match.

**Risk 3: `@commander-js/extra-typings` version-alignment trap.**
`extra-typings` must match the `commander` major version exactly. Both are pinned to `^14.x`. If one is bumped, the other must be bumped together. Mitigation: Step 12 adds a one-line note to `apps/cli/AGENTS.md`.

**Risk 4: figlet ESM/CJS interop on Bun.**
figlet ships as CJS with bundled `.d.ts`. Bun's interop handles this transparently in practice, but the import shape must be `import figlet from 'figlet'` (default), not `import * as figlet`. Verified in Solution §13. If a runtime error appears at startup, fallback is `const figlet = (await import('figlet')).default`.

**Risk 5: `bun:test` does not support `--filter` natively.**
`bun test --filter <pattern>` is not a Bun flag. Use `bun test apps/cli/tests/commands/scaffold/scaffold-init.test.ts` (path-based) or `bun test -t '<test-name-pattern>'` (test-name pattern). The plan's verification gates use path-based invocation.

### Review

#### Code Review Checklist

**Architecture & Type Safety**
- [ ] All imports come from `@commander-js/extra-typings`, never bare `commander` (except the `Command` type re-export, if any).
- [ ] No `clipanion` references remain anywhere in `apps/cli/` (grep `clipanion`, `Cli`, `Builtins`, `Option.String`, `Option.Boolean`, `runExit`, `this.context.stdout`, `this.context.stderr` → expect zero hits).
- [ ] No `BaseScaffoldCommand` references remain.
- [ ] Action handler `opts` parameters have inferred types — no `as any`, no `Record<string, unknown>` casts on `opts`.
- [ ] No `biome-ignore` suppressions added.

**Behavioral Parity**
- [ ] `tbs --help` lists all 5 scaffold subcommands plus the help/version builtins.
- [ ] `tbs --version` prints `CLI_CONFIG.binaryVersion`.
- [ ] `tbs scaffold <cmd> --help` prints per-command usage (commander format is acceptable).
- [ ] All flag names match pre-migration: `--name`, `--scope`, `--title`, `--brand`, `--repo-url`, `--bin`, `--skip-check`, `--dry-run`, `--json`, `--fix`.
- [ ] Positional `<feature>` argument required for `add` and `remove`.
- [ ] Exit codes: `0` on success, `1` on any error (parse, validation, runtime).

**Stream & Mode Handling**
- [ ] `--json` mode suppresses the figlet banner (verify by piping to `jq`: output must be valid JSON only).
- [ ] `--json` mode does not emit logger output to stdout (logger redirected to stderr in JSON mode — preserved from pre-migration).
- [ ] Stream injection works: passing custom `out`/`err` writables to `registerScaffoldCommands` captures all action handler output.

**Tests**
- [ ] All pre-existing test cases still present (no test deletions except `base-scaffold-command.test.ts` which is replaced by `scaffold-output.test.ts`).
- [ ] `bun test apps/cli/` — full pass.
- [ ] No `process.stdout.write` global mocking; tests use stream injection.
- [ ] `scaffold-validate --fix` test no longer uses `Reflect.set`; uses `bun:test` `mock()` on the spawn dependency.
- [ ] `program.exitOverride()` is set in `buildTestProgram()` so parse errors throw instead of exiting the test process.

**Dependencies**
- [ ] `apps/cli/package.json` no longer lists `clipanion`.
- [ ] `commander`, `@commander-js/extra-typings`, `figlet` present in `dependencies`.
- [ ] `@types/figlet` present in `devDependencies`.
- [ ] `commander` and `@commander-js/extra-typings` major versions match exactly (both `^14.x`).
- [ ] `bun.lock` updated and committed.

**Docs**
- [ ] `apps/cli/AGENTS.md` updated with the CLI Framework section (Step 12).
- [ ] `features/registry.ts` description updated (no "Clipanion" string remains).
- [ ] `config.ts` comment updated.
- [ ] `bun run check:docs` passes.

#### Reviewer Sign-off

| Concern | Reviewer | Status |
|---------|----------|--------|
| Architectural fit | | ☐ |
| Type-safety regressions | | ☐ |
| CLI behavioral parity | | ☐ |
| Test quality & coverage | | ☐ |

---

### Testing

#### Test Strategy

The migration preserves the existing test suite shape: per-command test files in `apps/cli/tests/commands/scaffold/`, mirroring `src/`. No new test categories are introduced.

#### Test Categories

| Category | Pattern | Example |
|----------|---------|---------|
| **Pure unit** (no commander) | Import module-level helpers, call directly | `validateInitOptions({ scope: '@x' })` |
| **Command registration** | Inspect `program.commands` shape | `expect(scaffold.commands.find(c => c.name() === 'init')).toBeDefined()` |
| **Option metadata** | Inspect `command.options` array | `expect(initCmd.options.map(o => o.long)).toContain('--dry-run')` |
| **Action handler (happy path)** | `await program.parseAsync(['scaffold', 'init', '--name', 'x', '--scope', '@y', '--dry-run', '--json'], { from: 'user' })`, assert captured stdout | JSON output structure |
| **Action handler (error path)** | Same, assert stderr + `process.exitCode` | Missing required arg, unknown feature |
| **Parse error** | `program.exitOverride(); expect(() => program.parseAsync(...)).toThrow(CommanderError)` | Unknown option |

#### Coverage Targets

The repo enforces coverage via `scripts/check-coverage.ts`. The migration must:

- Maintain or improve current coverage on `apps/cli/src/commands/scaffold/**`.
- Cover all commander action handlers (happy + error paths).
- Cover the new `scaffold-output.ts` helpers (`writeOutput` JSON/text/error branches, `formatDryRunPreview` for each `action` value, `writeSuccess` JSON/text branches).
- Cover the figlet banner suppression path in `index.ts` (skip if banner is not unit-testable; covered by smoke test instead).

#### Test Execution Order (during development)

```bash
# Per-step (incremental verification — Steps 2–7)
bun test apps/cli/tests/commands/scaffold/<file>.test.ts

# Per-package (after Step 11)
bun test apps/cli/

# Full repo gate (Step 15)
bun run check
```

#### Test Anti-patterns to Avoid

- **No `process.stdout.write` mocking** — use stream injection via `registerScaffoldCommands(program, out, err)`.
- **No `Reflect.set` monkey-patching** — refactor to dependency injection (see Risk 1 in Plan).
- **No exact stderr text matching for commander parse errors** — use `toContain('error:')` or similar partial matches; commander's wording differs from clipanion's (Risk 2).
- **No `process.exit` calls in action handlers during tests** — `process.exitCode = N` only; `program.exitOverride()` for parse errors.

#### Manual Smoke Test Script

After all automated gates pass, run the smoke commands from Plan §Step 16. Capture output to `/tmp/smoke-pre.txt` (pre-migration on a stash) vs `/tmp/smoke-post.txt` (post-migration) and `diff` them — only banner output and commander-flavored help text should differ.

---

### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References
- [Building a TypeScript CLI with Node.js and Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)
- [CLI Foundations with Commander.js](https://agentfactory.panaversity.org/docs/TypeScript-Language-Realtime-Interaction/cli-tools-developer-experience/cli-foundations-commande)
- [extra-typings for commander](https://github.com/commander-js/extra-typings/tree/main)
- [tj/commander.js](https://github.com/tj/commander.js)
- [cmatsuoka/figlet](https://github.com/cmatsuoka/figlet)
