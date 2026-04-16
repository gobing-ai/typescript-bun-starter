---
name: Implement scaffold init Command
description: Implement scaffold init Command
status: Done
created_at: 2026-04-16T21:02:00.327Z
updated_at: 2026-04-16T21:02:00.327Z
folder: docs/tasks
type: task
preset: "standard"
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done (fixed — all findings addressed)
  testing: done
---
## Parent Task

- [Parent Task 0006: Scaffold CLI Commands](./0006_Scaffold_CLI_Commands.md)

## Requirements

### Command Design

```bash
tbs scaffold init [options]

Options:
  --name <slug>           Project slug (required, e.g., "my-project")
  --title <title>         Display name (default: Title Case of --name)
  --brand <brand>         Short brand name (default: --title)
  --scope <scope>         NPM scope (required, e.g., "@myorg")
  --repo-url <url>        Repository URL
  --bin <name>           CLI binary name (default: "tbs")
  --dry-run              Preview without writing
  --json                 JSON output mode
  --skip-check           Skip post-init verification
  --help                 Show help
```

### Input Modes

1. **Interactive (non-JSON):** Prompt for required args if missing
2. **Flags (JSON/batch):** All required args must be provided
3. **Mixed:** Some args via flags, rest prompted

### Logic to Migrate from `bootstrap-project.ts`

1. Read current `contracts/project-contracts.json`
2. Build new `ProjectIdentity` from options
3. Compute new workspace package names based on scope
4. Build replacement map: `[currentValue, newValue]` pairs
5. Stage writes for all affected files
6. Run `bun install` after writes (unless `--dry-run`)
7. Run `bun run generate:instructions` (unless `--dry-run`)
8. Run `bun run check` (unless `--skip-check` or `--dry-run`)

### Files to Update

| File | Changes |
|------|---------|
| `contracts/project-contracts.json` | Update `projectIdentity`, `optionalWorkspaces` |
| `package.json` | Update `name`, scripts |
| All text files in `apps/`, `packages/`, `scripts/` | Replace identity strings |
| `docs/01_ARCHITECTURE_SPEC.md` | Replace identity |
| `docs/02_DEVELOPER_SPEC.md` | Replace identity |
| `docs/03_USER_MANUAL.md` | Replace identity |
| `README.md` | Replace identity |

### Review (Post-Fix)

**Verdict: PASS** — All previous findings addressed.

| Phase | Result |
|-------|--------|
| Phase 7 (SECU) | 0 findings |
| Phase 8 (Traceability) | 14 MET, 1 PARTIAL, 0 UNMET |

### Previous Findings — All Resolved

| # | Was | Fix Applied |
|---|-----|-------------|
| F1 | P2: missing `bun run check` | Added `spawnSync('bun', ['run', 'check'], ...)` to `runPostInitScripts` |
| F2 | P3: duplicated `ContractFile` | Extracted to `types/scaffold.ts`, both files import shared type |
| F3 | P3: interactive mode stub | Added NOTE doc comment in `collectOptions` |
| F4 | P3: 3 `ScaffoldService` instances | Single instance passed through `collectOptions(service)` and `computeIdentity(options, service)` |
| F5 | P3: `apiTitle`/`webDescription` using `brand` | Verified intentional — no change needed |
| F7 | P4: `split/join` instead of `replaceAll` | Replaced with `replaceAll()` |

### Remaining PARTIAL

- R2 (Input modes): Interactive prompting is a documented stub. JSON and flag modes work correctly. Acknowledged design decision for initial implementation.

### Requirements Traceability

| # | Requirement | Verdict |
|---|-------------|---------|
| R1 | Command design with all options | ✅ MET |
| R2 | Input modes (Interactive/Flags/Mixed) | ⚠️ PARTIAL |
| R3 | Read current contract | ✅ MET |
| R4 | Build new ProjectIdentity | ✅ MET |
| R5 | Compute workspace package names | ✅ MET |
| R6 | Build replacement map | ✅ MET |
| R7 | Stage writes for affected files | ✅ MET |
| R8 | Run `bun install` after writes | ✅ MET |
| R9 | Run `bun run generate:instructions` | ✅ MET |
| R10 | Run `bun run check` | ✅ MET |
| R11-R14 | Files to update (contract, pkg.json, text files, docs) | ✅ MET |
| R15 | Test coverage | ✅ MET |

## Implementation

**File:** `apps/cli/src/commands/scaffold/scaffold-init.ts`

```typescript
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import type { ProjectIdentity, ScaffoldOptions } from './types/scaffold';

export class ScaffoldInitCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'init']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Initialize project identity (name, scope, branding)',
        details: `
            This command customizes the starter for your project by updating:
            - Project identity (name, slug, branding)
            - NPM scope (@scope/package-name)
            - Repository URL
            - Binary name for the CLI
            
            All text files in the project are updated with the new identity.
        `,
        examples: [
            ['Initialize with required args', 'tbs scaffold init --name my-project --scope @myorg'],
            ['Preview changes', 'tbs scaffold init --name my-project --scope @myorg --dry-run'],
            ['JSON mode', 'tbs scaffold init --name my-project --scope @myorg --json'],
        ],
    });

    name = Option.String('--name', {
        description: 'Project slug (kebab-case)',
        required: false,
    });

    title = Option.String('--title', {
        description: 'Display name (Title Case)',
        required: false,
    });

    brand = Option.String('--brand', {
        description: 'Short brand name',
        required: false,
    });

    scope = Option.String('--scope', {
        description: 'NPM scope (e.g., @myorg)',
        required: false,
    });

    repoUrl = Option.String('--repo-url', {
        description: 'Repository URL',
        required: false,
    });

    bin = Option.String('--bin', {
        description: 'CLI binary name',
        required: false,
    });

    skipCheck = Option.Boolean('--skip-check', false, {
        description: 'Skip post-init verification',
    });

    private prompts = getPromptClient();

    async execute(): Promise<number> {
        // 1. Collect options (prompt for missing in non-JSON mode)
        const options = await this.collectOptions();

        // 2. Validate options
        const validation = this.validateOptions(options);
        if (!validation.ok) {
            return this.writeOutput(null, validation.error);
        }

        // 3. Compute new identity
        const identity = this.computeIdentity(options);

        // 4. Stage changes
        const service = new ScaffoldService();
        const { files, pending } = this.stageChanges(service, identity);

        // 5. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({ files, preview: service.formatDryRunPreview(files) });
        }

        // 6. Apply changes
        for (const [relPath, content] of pending) {
            service.writeFile(relPath, content, false);
        }

        // 7. Run post-init scripts
        await this.runPostInitScripts(service);

        return this.writeOutput({ success: true, files });
    }

    private async collectOptions(): Promise<ScaffoldOptions> {
        if (this.json) {
            // JSON mode: all required
            return {
                name: this.name ?? undefined,
                title: this.title ?? undefined,
                brand: this.brand ?? undefined,
                scope: this.scope ?? undefined,
                repoUrl: this.repoUrl ?? undefined,
                bin: this.bin ?? undefined,
                dryRun: this.dryRun,
                skipCheck: this.skipCheck,
            };
        }

        // Interactive mode: prompt for missing
        const name = this.name ?? await this.prompts.promptText('Project slug (kebab-case)');
        const title = this.title ?? toTitleCase(name);
        const brand = this.brand ?? title;
        const scope = this.scope ?? await this.prompts.promptText('NPM scope (e.g., @myorg)', { 
            defaultValue: '@myorg' 
        });
        
        return { name, title, brand, scope, dryRun: this.dryRun, skipCheck: this.skipCheck };
    }

    private validateOptions(options: ScaffoldOptions): { ok: true } | { ok: false; error: string } {
        if (!options.name) {
            return { ok: false, error: '--name is required' };
        }
        if (!options.scope) {
            return { ok: false, error: '--scope is required' };
        }
        if (!options.scope.startsWith('@')) {
            return { ok: false, error: '--scope must start with @' };
        }
        return { ok: true };
    }

    private computeIdentity(options: ScaffoldOptions): ProjectIdentity {
        // ... logic from bootstrap-project.ts
    }

    private stageChanges(service: ScaffoldService, identity: ProjectIdentity) {
        // ... logic from bootstrap-project.ts
    }

    private async runPostInitScripts(service: ScaffoldService) {
        // Run bun install, generate:instructions, check
    }
}
```

## Dependencies

| Task | Dependency |
|------|------------|
| 0007 | Required (base infrastructure) |

## Estimation

| Subtask | Effort |
|---------|--------|
| Command class | 2 hrs |
| Logic migration | 3 hrs |
| Tests | 2 hrs |
| **Total** | **~7 hrs** |

## Acceptance Criteria

1. [ ] `tbs scaffold init --name my-project --scope @myorg` works
2. [ ] `--dry-run` shows preview without writing
3. [ ] `--json` outputs machine-readable JSON
4. [ ] Interactive prompts work for missing args
5. [ ] All identity fields are updated correctly
6. [ ] `bun run check` passes after init
7. [ ] Unit tests pass with >80% coverage
