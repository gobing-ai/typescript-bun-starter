---
name: Scaffold CLI Commands
description: Scaffold CLI Commands
status: Done
created_at: 2026-04-16T21:01:52.407Z
updated_at: 2026-04-16T21:01:52.407Z
folder: docs/tasks
type: task
preset: "standard"
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---
## Background

The project currently uses imperative scripts in `scripts/` that are developer-facing but not discoverable via CLI. After cloning the starter, users run `bun run bootstrap` which is opaque. We need a user-friendly CLI:

```bash
# Deprecated (opaque)
bun run bootstrap
bun run clean-demo

# New discoverable interface
tbs scaffold init           # initialize project identity
tbs scaffold add webapp    # add optional features
tbs scaffold remove webapp  # remove optional features
```

> **Note:** The `skills` CRUD domain is built-in and always installed — it cannot be added or removed via scaffold commands.

## Requirements

### Core Commands (MVP)

| Command | Replaces | Description |
|---------|----------|-------------|
| `tbs scaffold init` | `bootstrap-project.ts` | Initialize project identity (name, scope, etc.) |
| `tbs scaffold add <feature>` | — | Add optional feature modules (cli, server, webapp) |
| `tbs scaffold remove <feature>` | `clean-demo.ts` | Remove optional feature modules (cli, server, webapp) |
| `tbs scaffold validate` | `check-contracts.ts` | Validate project contracts |

### Extended Commands (Phase 2)

| Command | Description |
|---------|-------------|
| `tbs scaffold list` | List available scaffold actions |

### Features

- [ ] All commands support `--dry-run` flag for preview
- [ ] All commands support `--json` flag for machine output
- [ ] All commands support `--help` (clipanion built-in)
- [ ] Interactive prompts for missing required args (non-JSON mode)
- [ ] Proper exit codes (0 = success, 1 = error)

### Constraints

- CLI is the single entry point (`tbs`)
- Commands must be testable (unit tests required)
- Commands must be documented with `Command.Usage`
- Must preserve `bun run check` as the verification gate

---

## Solution

### Task Breakdown

#### Phase 1: Scaffold Infrastructure (Foundation)

1. [ ] **0006.1** Create `apps/cli/src/commands/scaffold/` directory structure
2. [ ] **0006.2** Create base scaffold command class with shared options
3. [ ] **0006.3** Extract `ProjectIdentity` and `ScaffoldConfig` types to shared module
4. [ ] **0006.4** Create scaffold service layer (reusable logic)

#### Phase 2: `scaffold init` Command

5. [ ] **0006.5** Create `scaffold-init.ts` command
6. [ ] **0006.6** Migrate identity replacement logic from `bootstrap-project.ts`
7. [ ] **0006.7** Add `--name`, `--title`, `--brand`, `--scope` options
8. [ ] **0006.8** Add `--dry-run` and `--json` support
9. [ ] **0006.9** Write unit tests for `ScaffoldInitCommand`
10. [ ] **0006.10** Update `apps/cli/src/index.ts` to register command

#### Phase 3: `scaffold remove` Command

11. [ ] **0006.11** Create `scaffold-remove.ts` command
12. [ ] **0006.12** Define feature registry (skills, webapp, api, etc.)
13. [ ] **0006.13** Migrate file deletion logic from `clean-demo.ts`
14. [ ] **0006.14** Add `--feature` option with autocomplete
15. [ ] **0006.15** Write unit tests for `ScaffoldRemoveCommand`
16. [ ] **0006.16** Update `apps/cli/src/index.ts` to register command

#### Phase 4: `scaffold validate` Command

17. [ ] **0006.17** Create `scaffold-validate.ts` command
18. [ ] **0006.18** Migrate contract checking logic from `check-contracts.ts`
19. [ ] **0006.19** Add `--fix` flag to auto-fix contract issues
20. [ ] **0006.20** Write unit tests for `ScaffoldValidateCommand`
21. [ ] **0006.21** Update `apps/cli/src/index.ts` to register command

#### Phase 5: `scaffold list` Command (Optional)

22. [ ] **0006.22** Create `scaffold-list.ts` command
23. [ ] **0006.23** Implement feature discovery from registry
24. [ ] **0006.24** Write unit tests for `ScaffoldListCommand`

#### Phase 6: Cleanup & Integration

25. [ ] **0006.25** Update root `package.json` scripts (keep for backward compat)
26. [ ] **0006.26** Run `bun run check` to verify everything works
27. [ ] **0006.27** Update `docs/02_DEVELOPER_SPEC.md` with new commands
28. [ ] **0006.28** Update `README.md` with scaffold command documentation

---

### Dependency Graph

```
0006.1  Create directory structure
   |
   v
0006.2  Base scaffold class  <-- 0006.3 (parallel)
   |                         0006.4 (parallel)
   v
0006.3  Shared types  -----------------> 0006.4  Scaffold service
   |                                        |
   +-----> 0006.5  scaffold init  --------->+
   |          |
   |          v
   |    0006.6-0006.10  (init implementation + tests)
   |
   +-----> 0006.11  scaffold remove  ----->+
   |          |
   |          v
   |    0006.12-0006.16  (remove impl + tests)
   |
   +-----> 0006.17  scaffold validate  ---->+
   |          |
   |          v
   |    0006.18-0006.21  (validate impl + tests)
   |
   +-----> 0006.22-0006.24  scaffold list (optional)
   |
   v
0006.25-0006.28  Cleanup & docs
```

---

### Detailed Task Specifications

#### 0006.2: Base Scaffold Command Class

**File:** `apps/cli/src/commands/scaffold/base-scaffold-command.ts`

```typescript
import { Command, Option } from 'clipanion';

/**
 * Base class for all scaffold commands.
 * Provides shared options: --dry-run, --json
 */
export abstract class BaseScaffoldCommand extends Command {
    dryRun = Option.Boolean('--dry-run', false, {
        description: 'Preview changes without applying',
    });

    json = Option.Boolean('--json', false, {
        description: 'Output as JSON (agent mode)',
    });

    /**
     * Write output based on mode (text vs JSON)
     */
    protected writeOutput(data: unknown, error?: string): number {
        if (this.json) {
            const output = error ? { error } : data;
            this.context.stdout.write(`${JSON.stringify(output)}\n`);
        } else if (error) {
            this.context.stderr.write(`Error: ${error}\n`);
        }
        return error ? 1 : 0;
    }
}
```

#### 0006.3: Shared Types

**File:** `apps/cli/src/types/scaffold.ts`

```typescript
export interface ProjectIdentity {
    displayName: string;
    brandName: string;
    projectSlug: string;
    rootPackageName: string;
    repositoryUrl: string;
    binaryName: string;
    binaryLabel: string;
    apiTitle: string;
    webDescription: string;
}

export interface ScaffoldOptions {
    name?: string;
    title?: string;
    brand?: string;
    scope?: string;
    rootPackageName?: string;
    repoUrl?: string;
    bin?: string;
    dryRun?: boolean;
    skipCheck?: boolean;
}

export interface FeatureRegistry {
    name: string;
    description: string;
    files: string[];
    rewrites: Record<string, string>;
    dependencies?: string[];
}

export type ScaffoldResult = 
    | { ok: true; filesChanged: string[] }
    | { ok: false; error: string };
```

#### 0006.4: Scaffold Service

**File:** `apps/cli/src/services/scaffold-service.ts`

```typescript
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProjectIdentity, ScaffoldOptions, ScaffoldResult } from '../types/scaffold';

export class ScaffoldService {
    private root: string;

    constructor(root?: string) {
        this.root = root ?? resolve(import.meta.dir, '../../../../..');
    }

    /**
     * Initialize project with new identity
     */
    async initIdentity(options: ScaffoldOptions): Promise<ScaffoldResult> {
        // Logic migrated from bootstrap-project.ts
    }

    /**
     * Remove a feature module
     */
    async removeFeature(feature: string, dryRun: boolean): Promise<ScaffoldResult> {
        // Logic migrated from clean-demo.ts
    }

    /**
     * Validate project contracts
     */
    async validateContracts(fix: boolean): Promise<ScaffoldResult> {
        // Logic migrated from check-contracts.ts
    }

    /**
     * List available features
     */
    listFeatures(): FeatureRegistry[] {
        // Feature discovery from registry
    }
}
```

---

### Feature Registry Definition

**File:** `apps/cli/src/config/scaffold-features.ts`

```typescript
import type { FeatureRegistry } from '../types/scaffold';

export const SCAFFOLD_FEATURES: Record<string, FeatureRegistry> = {
    skills: {
        name: 'Skills',
        description: 'Skill management domain (SkillService, skill CRUD commands)',
        files: [
            'packages/core/src/schemas/skill.ts',
            'packages/core/src/services/skill-service.ts',
            'packages/core/tests/services/skill-service.test.ts',
            'apps/cli/src/commands/skill-create.ts',
            'apps/cli/src/commands/skill-delete.ts',
            'apps/cli/src/commands/skill-get.ts',
            'apps/cli/src/commands/skill-list.ts',
            'apps/cli/tests/commands/skill-create.test.ts',
            'apps/cli/tests/commands/skill-delete.test.ts',
            'apps/cli/tests/commands/skill-get.test.ts',
            'apps/cli/tests/commands/skill-list.test.ts',
            'apps/server/src/routes/skills.ts',
            'apps/server/tests/routes/skills.test.ts',
        ],
        rewrites: {
            'packages/core/src/db/schema.ts': `// Add your Drizzle table definitions here.\nexport {};\n`,
            'packages/core/src/config.ts': `// Core config without skill constraints`,
            'packages/core/src/index.ts': `// Core exports without skill exports`,
            'apps/cli/src/index.ts': `// CLI without skill commands`,
            'apps/server/src/index.ts': `// Server without skill routes`,
        },
    },
    webapp: {
        name: 'WebApp',
        description: 'Astro-based web application (apps/web)',
        files: ['apps/web/**/*'],
        rewrites: {
            'package.json': 'Remove webapp from workspaces',
        },
    },
    api: {
        name: 'API',
        description: 'Hono-based REST API server (apps/server)',
        files: ['apps/server/**/*'],
        rewrites: {
            'package.json': 'Remove server from workspaces',
        },
    },
    cli: {
        name: 'CLI',
        description: 'Clipanion-based CLI tool (apps/cli)',
        files: ['apps/cli/**/*'],
        rewrites: {
            'package.json': 'Remove cli from workspaces',
        },
    },
};

export const REQUIRED_FEATURES = ['contracts', 'core'];
export const OPTIONAL_FEATURES = ['cli', 'server', 'webapp', 'skills'];
```

---

### Phase 2: Add/Remove/List Features (Tasks 0010–0012)

#### 0010: Implement `tbs scaffold add`
- Read manifest for feature definition
- Copy template files to workspace
- Update `contracts/project-contracts.json` optionalWorkspaces
- Update root `package.json` scripts
- Run `bun install`
- Error if feature already exists

#### 0011: Implement `tbs scaffold validate`
- Migrate logic from `scripts/check-contracts.ts`
- Add `--fix` flag for auto-correction
- Validate all contract rules
- Exit with appropriate codes

#### 0012: Implement `tbs scaffold list`
- Implement feature discovery from registry
- Show available features and their status (installed/not installed)
- Support `--json` output

### Phase 3: Integration Testing & Verification (Task 0013)

#### 0013: Integration testing and verification
- End-to-end test: `tbs scaffold init --dry-run`
- End-to-end test: Add/remove cycles
- Test `init` dry-run, actual run, error cases
- Test `add` success, already-present error
- Test `remove` success, not-present error
- Test `list` output formatting
- Test `validate` pass/fail scenarios
- Verify `bun run check` passes after scaffold operations

### Phase 4: Documentation & Cleanup (Task 0014)

#### 0014: Documentation and cleanup
- Update `docs/03_USER_MANUAL.md` with scaffold commands
- Update `README.md` with quick-start guide
- Add examples for each scaffold subcommand
- Add deprecation warnings to `scripts/bootstrap-project.ts`
- Add deprecation warnings to `scripts/clean-demo.ts`
- Update `package.json` scripts with deprecation notes
- Plan removal in next major version
- Run `bun run check` (lint, typecheck, test, coverage)
- Verify all scaffold commands work as documented
- Ensure backward compatibility for existing users

---

## Dependencies

| Task | Blocking | Blocked By |
|------|----------|------------|
| 0007 | — | — |
| 0008 | 0007 | — |
| 0009 | 0007 | — |
| 0010 | 0007 | — |
| 0011 | 0007 | — |
| 0012 | 0007 | — |
| 0013 | 0008, 0009, 0010, 0011, 0012 | 0008, 0009, 0010, 0011, 0012 |
| 0014 | 0013 | 0013 |

---

## Notes

### Why Not Import Existing Scripts?

- `bootstrap-project.ts` is 400+ lines with tight coupling to file system
- `clean-demo.ts` modifies multiple files with hardcoded paths
- Migrating to command classes enables:
  - Interactive prompts
  - Better error handling
  - Unit testability
  - Discoverable CLI

### Template Strategy

Instead of maintaining separate "clean" versions:
1. Current files ARE the templates
2. On first `remove`, backup to `.scaffold-backup/`
3. On `add`, restore from backup or template

OR (simpler):
1. Store minimal templates in `scripts/scaffold/templates/`
2. Templates are the canonical "add" source
3. User modifications are preserved on `remove`

### Rollback Strategy

If `add` or `remove` fails mid-operation:
1. All operations are staged first (like bootstrap does)
2. On failure, log error but don't partially apply
3. User can re-run after fixing issues

---

## Acceptance Criteria

1. [x] `tbs scaffold --help` shows scaffold command group
2. [x] `tbs scaffold init --name my-project` works and updates all identity fields
3. [x] `tbs scaffold init --dry-run` shows preview without writing
4. [x] `tbs scaffold add <feature>` adds optional features (cli, server, webapp)
5. [x] `tbs scaffold remove <feature>` removes optional features (cli, server, webapp)
6. [x] `tbs scaffold list` shows correct feature status
7. [x] `tbs scaffold validate` passes on clean project
8. [x] All scaffold commands have `--json` flag for agent mode
9. [x] Unit tests cover all command paths
10. [x] `bun run check` passes after all implementations

> **Note:** The `skills` CRUD domain is built-in and always installed.
