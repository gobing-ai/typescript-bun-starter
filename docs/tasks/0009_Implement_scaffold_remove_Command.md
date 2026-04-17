---
name: Implement scaffold remove Command
description: Implement scaffold remove Command
status: Done
created_at: 2026-04-16T21:02:00.345Z
updated_at: 2026-04-16T21:02:00.345Z
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
## Parent Task

- [Parent Task 0006: Scaffold CLI Commands](./0006_Scaffold_CLI_Commands.md)

## Requirements

### Command Design

```bash
tbs scaffold remove <feature> [options]

Arguments:
  feature                 Feature to remove: skills, webapp, api, cli

Options:
  --dry-run              Preview without deleting
  --json                 JSON output mode
  --help                 Show help
```

### Available Features

| Feature | Description | Files Removed |
|---------|-------------|---------------|
| `skills` | Skill management domain | Core: `schemas/skill.ts`, `services/skill-service.ts`<br>CLI: `commands/skill-*.ts`<br>Server: `routes/skills.ts` |
| `webapp` | Astro web application | `apps/web/*` |
| `api` | Hono REST API | `apps/server/*` |
| `cli` | CLI tool | `apps/cli/*` |

### Logic to Migrate from `clean-demo.ts`

1. Read feature definition from registry
2. Stage file deletions
3. Stage file rewrites (strip feature references)
4. Apply changes (unless `--dry-run`)
5. Update `contracts/project-contracts.json` optionalWorkspaces
6. Run `bun install` (unless `--dry-run`)
7. Run `bun run generate:instructions` (unless `--dry-run`)

### Implementation

**File:** `apps/cli/src/commands/scaffold/scaffold-remove.ts`

```typescript
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import { SCAFFOLD_FEATURES, REQUIRED_FEATURES } from './features/registry';

export class ScaffoldRemoveCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'remove']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Remove optional feature modules',
        details: `
            Remove unused feature modules from the project.
            
            Available features:
            - webapp: Astro-based web application (apps/web)
            - server: Hono REST API server (apps/server)
            - cli: Clipanion CLI tool (apps/cli)
            
            Warning: Removing a feature also removes all associated tests.
        `,
        examples: [
            ['Remove webapp', 'tbs scaffold remove webapp'],
            ['Preview webapp removal', 'tbs scaffold remove webapp --dry-run'],
            ['JSON mode', 'tbs scaffold remove server --json'],
        ],
    });

    feature = Option.String();

    async execute(): Promise<number> {
        // 1. Validate feature name
        const featureDef = SCAFFOLD_FEATURES[this.feature];
        if (!featureDef) {
            return this.writeOutput(null, `Unknown feature: ${this.feature}. Run 'tbs scaffold list' to see available features.`);
        }

        // 2. Check if required feature
        if (REQUIRED_FEATURES.includes(this.feature)) {
            return this.writeOutput(null, `Cannot remove required feature: ${this.feature}`);
        }

        // 3. Check if feature exists
        if (!this.featureExists(featureDef)) {
            return this.writeOutput(null, `Feature '${this.feature}' is not installed.`);
        }

        // 4. Stage changes
        const service = new ScaffoldService();
        const { filesToDelete, filesToRewrite } = this.stageChanges(featureDef);

        // 5. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({
                feature: this.feature,
                filesToDelete,
                filesToRewrite,
                preview: `Would remove feature '${this.feature}':\n` +
                    `${filesToDelete.map(f => `  - ${f}`).join('\n')}\n\n` +
                    `Would rewrite:\n${filesToRewrite.map(f => `  - ${f}`).join('\n')}`
            });
        }

        // 6. Apply changes
        for (const relPath of filesToDelete) {
            service.deleteFile(relPath, false);
        }
        for (const [relPath, content] of filesToRewrite) {
            service.writeFile(relPath, content, false);
        }

        // 7. Update contracts
        await this.updateContracts(service);

        // 8. Run post-remove scripts
        await this.runPostRemoveScripts(service);

        return this.writeOutput({ success: true, feature: this.feature });
    }

    private featureExists(def: FeatureDefinition): boolean {
        // Check if any of the feature's key files exist
        const service = new ScaffoldService();
        return def.files.some(f => service.exists(f));
    }

    private stageChanges(def: FeatureDefinition) {
        const filesToDelete: string[] = [];
        const filesToRewrite: Array<[string, string]> = [];

        for (const file of def.files) {
            if (globMatch(file, '**/*')) {
                // Directory - collect all files
                filesToDelete.push(...collectFilesInDir(file));
            } else {
                filesToDelete.push(file);
            }
        }

        for (const [relPath, content] of Object.entries(def.rewrites)) {
            filesToRewrite.push([relPath, content]);
        }

        return { filesToDelete, filesToRewrite };
    }

    private async updateContracts(service: ScaffoldService) {
        const contractPath = resolve(service.getRoot(), 'contracts/project-contracts.json');
        const contract = service.readJson(contractPath);
        
        // Remove from optionalWorkspaces
        delete contract.optionalWorkspaces[`apps/${this.feature === 'api' ? 'server' : this.feature}`];
        
        service.writeFile('contracts/project-contracts.json', JSON.stringify(contract, null, 4), false);
    }

    private async runPostRemoveScripts(service: ScaffoldService) {
        // Run bun install, generate:instructions
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
| Command class | 1.5 hrs |
| Logic migration | 2 hrs |
| Tests | 1.5 hrs |
| **Total** | **~5 hrs** |

## Acceptance Criteria

1. [x] `tbs scaffold remove <feature>` removes optional feature files
2. [x] `tbs scaffold remove webapp` removes Astro app
3. [x] `--dry-run` shows preview without deleting
4. [x] Cannot remove required features (contracts, core)
5. [x] Error if feature not installed
6. [x] `contracts/project-contracts.json` is updated
7. [x] Unit tests pass

> **Note:** The `skills` CRUD domain is built-in and always installed.

## Requirements Traceability

- [x] **AC1**: `tbs scaffold remove <feature>` removes optional feature files → **MET** | Evidence: `scaffold-remove.ts:execute()` → `stageChanges()` iterates `SCAFFOLD_FEATURES[feature].files`, deletes via `service.deleteFile()`
- [x] **AC2**: `tbs scaffold remove webapp` removes Astro app → **MET** | Evidence: Registry defines webapp files (registry.ts); `execute()` deletion loop handles them
- [x] **AC3**: `--dry-run` shows preview without deleting → **MET** | Evidence: `execute():79-87` returns preview data before any side effects
- [x] **AC4**: Cannot remove required features → **MET** | Evidence: `isRequiredFeature()` check; tests verify rejection for contracts/core
- [x] **AC5**: Error if feature not installed → **MET** | Evidence: `isInstalled()` check returns error message
- [x] **AC6**: `contracts/project-contracts.json` updated → **MET** | Evidence: `updateContracts()` removes from optionalWorkspaces + dependencyRules
- [x] **AC7**: Unit tests pass → **MET** | Evidence: 38 tests pass, 100% branch coverage
- [x] **R8**: Run `bun install` after removal → **FIXED** | Evidence: `runPostRemoveScripts()` calls `service.runShell('bun install')`
- [x] **R9**: Run `bun run generate:instructions` after removal → **FIXED** | Evidence: `runPostRemoveScripts()` calls `service.runShell('bun run generate:instructions')`

## Review — 2026-04-16 (fix pass)

**Status:** All 5 findings resolved
**Scope:** `apps/cli/src/commands/scaffold/scaffold-remove.ts`, `services/scaffold-service.ts`, test file
**Mode:** verify (full), fix pass
**Channel:** current
**Gate:** `bun run check` → PASS (369 tests, 0 failures)

### Fixes Applied

| # | Finding | Fix | Files Changed |
|---|---------|-----|---------------|
| 1 | Missing post-remove scripts | Added `runPostRemoveScripts()` calling `bun install` + `bun run generate:instructions` | `scaffold-remove.ts`, `scaffold-service.ts` |
| 2 | Hardcoded display name for Skills | Changed `featureDef.name === 'Skills'` → `this.feature === 'skills'` (stable key) | `scaffold-remove.ts` |
| 3 | Fragile dependency rule matching | Replaced `key.includes(...)` substring match with exact `pkg in dependencyRules` using registry package names | `scaffold-remove.ts` |
| 4 | Redundant empty constructor | Removed `constructor() { super(); }` | `scaffold-remove.ts` |
| 5 | Dead code `!this.feature` guard | Removed unreachable guard | `scaffold-remove.ts` |

### New additions

- `ScaffoldService.runShell(command)`: Executes shell commands in project root via `execSync`
- `ScaffoldRemoveCommand.runPostRemoveScripts()`: Runs post-removal scripts for workspace consistency
- Test: `runPostRemoveScripts > should run bun install and generate:instructions`
- Tests: `stageChanges` tests updated to bind `this` context + set `feature` property

### Verdict: **PASS**

All findings resolved. All requirements MET. Gate check passes.
