---
name: Design a reusable policy-driver CLI with pluggable policy formats and optional auto-healing
description: Design a reusable policy-driver CLI with pluggable policy formats and optional auto-healing
status: Done
created_at: 2026-04-23T21:45:38.040Z
updated_at: 2026-04-23T22:53:49.595Z
folder: docs/tasks
type: task
priority: high
estimated_hours: 10
tags: ["tooling","policy","cli","architecture"]
impl_progress:
  planning: in_progress
  design: pending
  implementation: pending
  review: pending
  testing: pending
---

## 0016. Design a reusable policy-driver CLI with pluggable policy formats and optional auto-healing

### Background

Need a project-agnostic command-line tool that enforces repository policies through declarative policy files instead of accumulating one-off check scripts. The tool must support modular policy files, keep file format replaceable, default to fast text-based enforcement, and leave room for syntax-aware rules and safe auto-healing where fixes are deterministic.


### Requirements

Deliver a generic policy-driver design and implementation task specification for this repo and future projects. The solution must support running all policies or selected policy files, isolate policy definitions per concern, abstract policy-file parsing from the engine, prefer rg-backed matching for v1, allow future sg-backed rules, and support optional --fix for simple deterministic commands or rewrites. The tool itself should be designed as a reusable command-line utility rather than a repo-specific script.


### Q&A

### Q: Should policy definitions live in one big central file?

No. Use one policy file per concern and let the driver run all or selected policies.

### Q: Should the first version use JSON, JSONC, or YAML?

Use JSON first, but keep the engine format-agnostic through loader adapters. Do not couple the engine to JSON syntax details.

### Q: Do we need comments in policy files?

Not as a hard requirement. Prefer schema fields such as `description`, `rationale`, and `notes` so meaning stays available regardless of file syntax.

### Q: Should the first version default to `sg` because it is more precise?

No. Default to `rg` in v1 because it is fast, simple, and sufficient for most boundary-style rules. Add `sg` later where syntax awareness is justified.

### Q: Should the driver implement complex automatic rewrites itself?

No. Keep v1 autofix narrow. Prefer explicit simple fix commands and only allow deterministic safe fixes.

### Q: Should all existing bespoke checks be forced into the new driver immediately?

No. Migrate the checks that naturally fit the policy-driver model first, then evaluate more complex checks individually.


### Q: Should policy definitions live in one big central file?

No. Use one policy file per concern and let the driver run all or selected policies.

### Q: Should the first version use JSON, JSONC, or YAML?

Use JSON first, but keep the engine format-agnostic through loader adapters. Do not couple the engine to JSON syntax details.

### Q: Do we need comments in policy files?

Not as a hard requirement. Prefer schema fields such as `description`, `rationale`, and `notes` so meaning stays available regardless of file syntax.

### Q: Should the first version default to `sg` because it is more precise?

No. Default to `rg` in v1 because it is fast, simple, and sufficient for most boundary-style rules. Add `sg` later where syntax awareness is justified.

### Q: Should the driver implement complex automatic rewrites itself?

No. Keep v1 autofix narrow. Prefer explicit simple fix commands and only allow deterministic safe fixes.

### Q: Should all existing bespoke checks be forced into the new driver immediately?

No. Migrate the checks that naturally fit the policy-driver model first, then evaluate more complex checks individually.


### Design

## Problem Statement

The repository already has a few policy-style checks such as DB boundary enforcement and documentation validation. That approach works at small scale, but it does not scale well if every new repository contract requires a new bespoke `check-*.ts` script. The result would be duplicated code for file discovery, scanning, allowlists, diagnostics, pass/fail handling, and future autofix plumbing.

This task is to design and implement a reusable command-line policy driver that can be adopted by this repo and also extracted or reused in other projects. The driver must load one or more declarative policy files, execute the defined checks, report violations consistently, and optionally apply safe deterministic fixes.

The design must stay pragmatic:

- v1 should prefer fast text-based matching with `rg`
- syntax-aware matching with `sg` should be an extension point, not the default
- policy-file syntax must be replaceable without changing the engine
- policy files must be modular, with one file per concern rather than one giant central registry
- autofix must be explicit, constrained, and safe by default

## Architectural Goals

1. Replace one-off policy-check scripts with a reusable driver and policy documents.
2. Keep policy definitions modular and independently runnable.
3. Keep the policy-file format swappable through loader adapters.
4. Provide a stable internal `PolicyDocument` representation independent of file syntax.
5. Default to `rg`-backed execution for simple and fast checks.
6. Allow future `sg`-backed rule kinds for syntax-aware enforcement and safe rewrites.
7. Support optional deterministic auto-healing for rules that can be fixed with a simple explicit command or rewrite.
8. Design the tool as a generic CLI utility suitable for any project, not only this repository.


### Solution

## Recommended Architecture

Build one reusable CLI driver and a set of independent policy files.

### CLI shape

Recommended entrypoint names:

- repo-local first cut: `scripts/check-policies.ts`
- reusable command shape: `policy-check` or `policy-driver`

The CLI must support:

- run all discovered policies by default
- run one or more explicitly selected policies
- `--policy <name-or-path>` repeated multiple times
- `--fix` to apply safe allowed fixes only
- `--dry-run` to preview fixes without modifying files
- `--json` for machine-readable output
- non-zero exit code when violations remain or fix commands fail

### Policy storage model

Use a directory of independent policy files rather than one centralized policy file.

Recommended layout:

```text
policies/
  output-boundaries.json
  db-boundaries.json
  docs.json
```

Rationale:

- avoids a giant dumping-ground policy file
- keeps ownership and review scope per concern
- makes local debugging and CI targeting easier
- allows different policies to evolve independently
- supports future mixed rule engines per policy

### Internal model

Do not bind the engine to JSON, JSONC, or YAML. Define an internal TypeScript model that every loader returns.

Example internal shapes:

```ts
interface PolicyDocument {
    id: string;
    description: string;
    rationale?: string[];
    notes?: string[];
    targets: string[];
    include?: string[];
    exclude?: string[];
    rules: PolicyRule[];
}

interface PolicyRule {
    id: string;
    engine: 'rg' | 'sg';
    message: string;
    severity?: 'error' | 'warning';
    allow?: string[];
    match: MatchSpec;
    fix?: FixSpec;
}
```

### Loader abstraction

Support file-format replacement through loader adapters.

Example shape:

```ts
interface PolicyLoader {
    supports(path: string): boolean;
    load(path: string): Promise<PolicyDocument>;
}
```

Planned loaders:

- JSON loader in v1
- JSONC loader later without engine changes
- YAML loader later without engine changes

### Rule-engine strategy

V1 should be `rg`-first.

Use `rg` for:

- banned imports
- banned direct stdout/stderr writes
- forbidden re-exports
- placeholder text checks
- directory-boundary checks
- line-oriented content policies

Add `sg` only as an extension point for cases where syntax awareness is genuinely needed:

- call-expression matching that regex cannot do reliably
- import-specifier awareness beyond regex confidence
- safe structural rewrites
- lower false-positive matching in comments/strings if that becomes a real problem

### Fix strategy

Detection and fixing must be modeled separately.

Constraints:

- fixes are optional, never implicit
- only rules marked safe may run under `--fix`
- `--dry-run` must show intended actions
- fix failure must fail closed
- all applied fixes must be reported clearly

Supported v1 fix modes:

1. `command`
   Run a simple explicit command, likely built around `sg --rewrite`.
2. `rewrite`
   Driver-native constrained substitution for trivial deterministic cases if needed.

Prefer `command` for most autofix rules so the driver does not become a general-purpose refactoring engine.


### Plan

## Phase 1. Define the command-tool contract

- choose the durable CLI name and argument model
- define default discovery behavior for policy files
- define how `--policy` accepts names vs paths
- define output modes: human-readable and `--json`
- define exit-code semantics for pass, violations, fix-applied, and fix-failed states

## Phase 2. Define and validate the internal schema

- create TypeScript interfaces for `PolicyDocument`, `PolicyRule`, `MatchSpec`, and `FixSpec`
- add schema validation for loaded policy files
- ensure the schema is independent of the source file format
- add fields for `description`, `rationale`, and `notes` so comments are not required for meaning

## Phase 3. Implement loader adapters

- implement JSON loader first
- register loaders by extension
- make unsupported extensions fail with clear diagnostics
- keep JSONC/YAML support behind a clean adapter seam even if not implemented immediately

## Phase 4. Implement the execution engine

- discover policy files
- normalize include/exclude/allow paths
- execute `rg`-backed rules
- aggregate violations consistently
- print deterministic diagnostics with file, line, rule id, and message

## Phase 5. Add optional fix support

- implement `--fix`
- implement `--dry-run`
- support safe `command` fix mode first
- make fix execution explicit in diagnostics
- ensure the command runner cannot silently mutate files outside explicit `--fix`

## Phase 6. Dogfood with real policies

- migrate `output-boundaries` into a policy file
- migrate `db-boundaries` into a policy file
- evaluate whether doc checks belong in the same framework or remain separate due to richer semantics
- wire the new command into `package.json`

## Phase 7. Verification and packaging posture

- add focused unit tests for parsing, execution, violation reporting, and fix gating
- add integration tests with sample policy fixtures and sample source files
- verify the tool can be run as a generic command in another project layout with configurable policy roots
- document how other projects can adopt the tool and author new policies


### Review



### Testing

## Verification Strategy

### Unit tests

Add tests for:

- policy loader selection by extension
- JSON policy parsing into the internal schema
- schema validation errors for malformed policy files
- allowlist matching behavior
- include/exclude path resolution
- violation rendering structure
- fix gating under `--fix` and `--dry-run`
- command-fix failure behavior

### Integration tests

Create fixtures that verify:

- running all policies from a policy directory
- running a selected policy by name
- running a selected policy by explicit path
- `rg` rule execution against fixture source files
- zero violations on allowed files
- expected failures on forbidden usage
- `--json` output shape
- `--fix` applies only safe fixes
- `--dry-run --fix` reports intended edits without changing files

### Reliability checks

- verify deterministic output ordering
- verify exit codes are stable and documented
- verify path normalization works across repo-relative and absolute invocation contexts
- verify unsupported policy formats fail clearly instead of being ignored
- verify unsupported rule engines fail clearly instead of silently downgrading behavior

## Acceptance Criteria

1. A reusable CLI policy driver exists and is designed to run in arbitrary projects, not just this repository.
2. Policy definitions are stored as independent policy files rather than one centralized policy file.
3. The driver can run all discovered policies by default and can also run one or more selected policy files via CLI arguments.
4. The engine uses one internal `PolicyDocument` model that is independent of the source policy-file format.
5. The implementation includes a loader abstraction that makes future JSONC or YAML support possible without changing rule execution.
6. V1 supports `rg`-backed rule execution for text and boundary policies.
7. The design leaves room for future `sg`-backed rules without forcing AST matching into v1.
8. Policy files can express rationale and notes in schema fields so comments are not required for meaning.
9. The CLI supports optional `--fix` and `--dry-run` modes.
10. Autofix is limited to explicit safe deterministic fixes and fails closed on command errors.
11. At least two real policies from this repo are migrated or modeled through the new driver as proof of design viability.
12. The tool has unit and integration coverage for loading, execution, diagnostics, and fix behavior.
13. The implementation is documented well enough that another project can adopt the tool and author policy files without reading the source first.


### Unit tests

Add tests for:

- policy loader selection by extension
- JSON policy parsing into the internal schema
- schema validation errors for malformed policy files
- allowlist matching behavior
- include/exclude path resolution
- violation rendering structure
- fix gating under `--fix` and `--dry-run`
- command-fix failure behavior

### Integration tests

Create fixtures that verify:

- running all policies from a policy directory
- running a selected policy by name
- running a selected policy by explicit path
- `rg` rule execution against fixture source files
- zero violations on allowed files
- expected failures on forbidden usage
- `--json` output shape
- `--fix` applies only safe fixes
- `--dry-run --fix` reports intended edits without changing files

### Reliability checks

- verify deterministic output ordering
- verify exit codes are stable and documented
- verify path normalization works across repo-relative and absolute invocation contexts
- verify unsupported policy formats fail clearly instead of being ignored
- verify unsupported rule engines fail clearly instead of silently downgrading behavior

## Acceptance Criteria

1. A reusable CLI policy driver exists and is designed to run in arbitrary projects, not just this repository.
2. Policy definitions are stored as independent policy files rather than one centralized policy file.
3. The driver can run all discovered policies by default and can also run one or more selected policy files via CLI arguments.
4. The engine uses one internal `PolicyDocument` model that is independent of the source policy-file format.
5. The implementation includes a loader abstraction that makes future JSONC or YAML support possible without changing rule execution.
6. V1 supports `rg`-backed rule execution for text and boundary policies.
7. The design leaves room for future `sg`-backed rules without forcing AST matching into v1.
8. Policy files can express rationale and notes in schema fields so comments are not required for meaning.
9. The CLI supports optional `--fix` and `--dry-run` modes.
10. Autofix is limited to explicit safe deterministic fixes and fails closed on command errors.
11. At least two real policies from this repo are migrated or modeled through the new driver as proof of design viability.
12. The tool has unit and integration coverage for loading, execution, diagnostics, and fix behavior.
13. The implementation is documented well enough that another project can adopt the tool and author policy files without reading the source first.


### Unit tests

Add tests for:

- policy loader selection by extension
- JSON policy parsing into the internal schema
- schema validation errors for malformed policy files
- allowlist matching behavior
- include/exclude path resolution
- violation rendering structure
- fix gating under `--fix` and `--dry-run`
- command-fix failure behavior

### Integration tests

Create fixtures that verify:

- running all policies from a policy directory
- running a selected policy by name
- running a selected policy by explicit path
- `rg` rule execution against fixture source files
- zero violations on allowed files
- expected failures on forbidden usage
- `--json` output shape
- `--fix` applies only safe fixes
- `--dry-run --fix` reports intended edits without changing files

### Reliability checks

- verify deterministic output ordering
- verify exit codes are stable and documented
- verify path normalization works across repo-relative and absolute invocation contexts
- verify unsupported policy formats fail clearly instead of being ignored
- verify unsupported rule engines fail clearly instead of silently downgrading behavior


### Unit tests

Add tests for:

- policy loader selection by extension
- JSON policy parsing into the internal schema
- schema validation errors for malformed policy files
- allowlist matching behavior
- include/exclude path resolution
- violation rendering structure
- fix gating under `--fix` and `--dry-run`
- command-fix failure behavior

### Integration tests

Create fixtures that verify:

- running all policies from a policy directory
- running a selected policy by name
- running a selected policy by explicit path
- `rg` rule execution against fixture source files
- zero violations on allowed files
- expected failures on forbidden usage
- `--json` output shape
- `--fix` applies only safe fixes
- `--dry-run --fix` reports intended edits without changing files

### Reliability checks

- verify deterministic output ordering
- verify exit codes are stable and documented
- verify path normalization works across repo-relative and absolute invocation contexts
- verify unsupported policy formats fail clearly instead of being ignored
- verify unsupported rule engines fail clearly instead of silently downgrading behavior


### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References


