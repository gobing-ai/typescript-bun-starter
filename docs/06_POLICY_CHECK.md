# Policy Check Guide

> Canonical guide for the reusable policy driver in `scripts/policy-check.ts`. This documents the tool as implemented in this starter and explains how to author, run, and fix policies safely.

## 1. Design Goal

The policy driver exists to enforce repository rules without accumulating one bespoke `check-*.ts` script per concern.

The design is intentionally simple:

- one reusable CLI driver
- one policy file per concern
- fast text-oriented enforcement with `rg`
- optional auto-healing for deterministic cases

This starter uses it for rules such as:

- Bun-only workflow checks
- test-framework migration checks
- DB boundary checks
- git safety checks
- logger usage checks
- output boundary checks

## 2. Command Reference

Run all policies:

```bash
bun run check:policy
```

Run a specific policy by id:

```bash
bun run scripts/policy-check.ts --policy db-boundaries
```

Run a policy by explicit path:

```bash
bun run scripts/policy-check.ts --policy ./policies/db-boundaries.json
```

Preview fixes without writing files:

```bash
bun run scripts/policy-check.ts --fix --dry-run
```

Apply fixes:

```bash
bun run scripts/policy-check.ts --fix
```

Emit machine-readable JSON:

```bash
bun run scripts/policy-check.ts --machine
```

Use another policy directory or project root:

```bash
bun run scripts/policy-check.ts --policy-dir ./policies --cwd /path/to/project
```

## 3. CLI Options

- `-p, --policy <name>`
  Run one or more selected policies. If omitted, the driver loads every `.json` file in `--policy-dir`.
- `--fix`
  Apply safe fixes where the policy defines one.
- `--dry-run`
  Show what fixes would run without modifying files.
- `--machine`
  Print JSON to stdout instead of the human report.
- `--policy-dir <path>`
  Policy directory to scan. Default: `policies`.
- `--cwd <path>`
  Project root used for policy discovery, path normalization, and command execution. Default: current directory.
- `--fail-fast`
  Stop once the first policy load or execution error is encountered.

## 4. Policy File Model

Policy files live under `policies/` and are stored one file per concern.

Example:

```json
{
    "id": "output-boundaries",
    "description": "Disallow direct stdout/stderr writes outside approved exceptions.",
    "rationale": [
        "Human-facing plain output should flow through echo/echoError."
    ],
    "targets": ["apps/**/*.ts", "packages/**/*.ts", "scripts/**/*.ts"],
    "exclude": ["**/tests/**"],
    "rules": [
        {
            "id": "no-process-stdout-write",
            "engine": "rg",
            "message": "Use echo(...) instead of process.stdout.write(...).",
            "severity": "error",
            "allow": ["scripts/smoke-generated-project.ts", "scripts/policy-check.ts"],
            "match": {
                "kind": "rg",
                "pattern": "process\\.stdout\\.write\\("
            }
        }
    ]
}
```

Top-level fields:

- `id`
  Stable policy identifier.
- `description`
  Short statement of what the policy enforces.
- `rationale`
  Optional list of reasons the rule exists.
- `notes`
  Optional implementation notes for maintainers.
- `targets`
  File globs scanned by the policy.
- `include`
  Optional positive path filter applied after discovery.
- `exclude`
  Optional negative path filter applied during discovery.
- `rules`
  Non-empty list of rule definitions.

Rule fields:

- `id`
  Stable rule identifier within the policy.
- `engine`
  Matching backend. Current practical backend is `rg`.
- `message`
  Violation text shown to the user.
- `severity`
  `error` or `warning`. Omitted defaults to `error`.
- `allow`
  Optional glob allowlist for approved exceptions.
- `match`
  Engine-specific match definition.
- `fix`
  Optional fix definition.

## 5. Matching Engines

### `rg`

`rg` is the default and preferred engine.

Use it for:

- banned imports
- forbidden direct writes
- logger usage checks
- placeholder detection
- boundary checks
- other line-oriented text policies

Benefits:

- fast
- simple to reason about
- easy to carry into other repos

### `sg`

The schema leaves room for `sg`, but this driver does not implement `sg` execution yet.

Current behavior:

- the rule is treated as an execution error
- the policy run fails closed

That is deliberate. Unsupported engines must not silently pass.

## 6. Fix Modes

The driver supports two fix modes today:

### `rewrite`

`rewrite` is the preferred fix mode.

It uses the rule's `match.pattern` as a regular expression and replaces matches with `fix.replace`.

Example:

```json
{
    "id": "no-console-log",
    "engine": "rg",
    "message": "Use logger.log instead of console.log",
    "match": {
        "kind": "rg",
        "pattern": "console\\.log"
    },
    "fix": {
        "mode": "rewrite",
        "replace": "logger.log"
    }
}
```

Why `rewrite` is preferred:

- deterministic behavior
- cross-platform
- no shell invocation
- no dependency on external tools like `sed`

When to use it:

- straightforward textual migrations
- first-pass codebase cleanup
- mechanical API renames

### `command`

`command` is still supported.

It executes an external command after tokenizing the command string into argv. It does **not** use `sh -c`.

Example:

```json
{
    "fix": {
        "mode": "command",
        "command": "echo fixed {path}"
    }
}
```

Placeholder support:

- `{path}` → matched file path
- `{cwd}` → configured working directory

When to use it:

- the fix genuinely needs another CLI tool
- a direct text rewrite is not enough

Tradeoffs:

- depends on external tools being installed
- still less predictable than `rewrite`
- harder to make portable across arbitrary projects

## 7. Why Some Policies Use `rewrite` Instead Of `command`

The `logger` and `bun-test` policies intentionally use `rewrite` instead of `command`.

Reason:

- earlier command-based versions depended on shell-style `sed`
- that was platform-specific and fragile
- the real desired behavior was a direct textual replacement

So these policies now use `rewrite` for portability and determinism.

This does **not** mean `command` mode was removed.

Current support status:

- `rewrite` — supported
- `command` — supported
- any other fix mode — not supported

## 8. Auto-Healing Philosophy

Auto-healing is intentionally conservative in implementation, but not always compiler-clean in outcome.

That is an important distinction.

For example, `logger` and `bun-test` fixes are designed as first-pass migrations for existing projects:

- they perform the mechanical rename
- they may still leave import or API cleanup behind
- compile errors after the rewrite are acceptable if the migration meaningfully advances the codebase

This is useful for large existing projects where “replace the obvious calls first, then clean up compile errors” is the pragmatic workflow.

Use `--dry-run` first if you want to inspect what would change before writing files.

## 9. Output Behavior

Human mode prints:

- loaded policies
- grouped violations
- fixes
- summary

Machine mode prints JSON only:

```bash
bun run scripts/policy-check.ts --machine
```

The JSON includes:

- `policies`
- `violations`
- `fixes`
- `summary`
- `errors`
- `exitCode`

## 10. Exit Semantics

The driver exits non-zero when any of these happen:

- policy directory missing
- policy load failure
- rule execution failure
- unsupported engine
- violations remain
- fix fails

This is intentional. The tool fails closed instead of silently passing.

## 11. Authoring Guidelines

Use these rules when adding new policies:

1. Prefer one policy file per concern.
2. Prefer `rg` over unsupported or speculative engines.
3. Prefer `rewrite` over `command` when a direct text replacement is enough.
4. Keep `allow` entries explicit and narrow.
5. Use `description`, `rationale`, and `notes` instead of relying on comments.
6. Test the policy against the current repo before treating it as canonical.
7. Add or update dedicated tests in `scripts/policy-check.test.ts` when the driver behavior changes.

## 12. Verification Checklist

Before closing policy-driver changes:

```bash
bun run check:policy
bun run typecheck
bun test scripts/policy-check.test.ts
bun run check
```

For fix-heavy policy work, also run:

```bash
bun run scripts/policy-check.ts --fix --dry-run
```

Confirm:

- the intended policy files load
- the summary reflects real files checked
- machine mode emits valid JSON only
- fixes behave deterministically
- unsupported engines fail closed
