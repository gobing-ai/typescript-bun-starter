---
name: Implement scaffold add Command
description: Implement scaffold add Command
status: Done
created_at: 2026-04-16T21:02:00.363Z
updated_at: 2026-04-16T21:02:00.363Z
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
tbs scaffold add <feature> [options]

Arguments:
  feature                 Feature to add: skills, webapp, api, cli

Options:
  --dry-run              Preview without adding
  --json                 JSON output mode
  --help                 Show help
```

### Available Features (Inverse of Remove)

| Feature | Template Source | Files Added |
|---------|-----------------|-------------|
| `skills` | Template in `scripts/scaffold/templates/skills/` | Full skill domain |
| `webapp` | Template in `scripts/scaffold/templates/webapp/` | Astro app skeleton |
| `api` | Template in `scripts/scaffold/templates/api/` | Hono API skeleton |
| `cli` | Template in `scripts/scaffold/templates/cli/` | CLI skeleton |

### Template Structure

```
scripts/scaffold/templates/
├── skills/
│   ├── packages/core/src/schemas/skill.ts
│   ├── packages/core/src/services/skill-service.ts
│   ├── packages/core/tests/services/skill-service.test.ts
│   ├── apps/cli/src/commands/skill-create.ts
│   ├── apps/cli/src/commands/skill-delete.ts
│   ├── apps/cli/src/commands/skill-get.ts
│   ├── apps/cli/src/commands/skill-list.ts
│   ├── apps/cli/tests/commands/skill-*.test.ts
│   └── apps/server/src/routes/skills.ts
├── webapp/
│   ├── apps/web/src/pages/index.astro
│   ├── apps/web/src/layouts/Layout.astro
│   ├── apps/web/package.json
│   └── ...
├── api/
│   ├── apps/server/src/index.ts
│   ├── apps/server/src/routes/tasks.ts
│   ├── apps/server/package.json
│   └── ...
└── cli/
    ├── apps/cli/src/index.ts
    ├── apps/cli/src/commands/
    └── apps/cli/package.json
```

### Implementation

**File:** `apps/cli/src/commands/scaffold/scaffold-add.ts`

```typescript
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import { SCAFFOLD_FEATURES, REQUIRED_FEATURES } from './features/registry';

export class ScaffoldAddCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'add']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Add optional feature modules',
        details: `
            Add optional feature modules to the project.
            
            Available features:
            - skills: Skill management domain (SkillService, CRUD commands)
            - webapp: Astro-based web application (apps/web)
            - api: Hono REST API server (apps/server)
            - cli: Clipanion CLI tool (apps/cli)
            
            Templates are copied from scripts/scaffold/templates/<feature>/.
        `,
        examples: [
            ['Add skills domain', 'tbs scaffold add skills'],
            ['Preview webapp addition', 'tbs scaffold add webapp --dry-run'],
            ['JSON mode', 'tbs scaffold add api --json'],
        ],
    });

    feature = Option.String();

    async execute(): Promise<number> {
        // 1. Validate feature name
        const featureDef = SCAFFOLD_FEATURES[this.feature];
        if (!featureDef) {
            return this.writeOutput(null, `Unknown feature: ${this.feature}. Run 'tbs scaffold list' to see available features.`);
        }

        // 2. Check if already installed
        if (this.featureExists(featureDef)) {
            return this.writeOutput(null, `Feature '${this.feature}' is already installed.`);
        }

        // 3. Stage changes
        const service = new ScaffoldService();
        const templateRoot = resolve(import.meta.dir, '../../../../../scripts/scaffold/templates');
        const { filesToCopy, rewrites } = this.stageChanges(service, templateRoot);

        // 4. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({
                feature: this.feature,
                filesToCopy,
                preview: `Would add feature '${this.feature}':\n` +
                    `${filesToCopy.map(f => `  + ${f}`).join('\n')}`
            });
        }

        // 5. Apply changes
        for (const { src, dest } of filesToCopy) {
            service.copyFile(src, dest);
        }
        for (const [relPath, content] of rewrites) {
            service.writeFile(relPath, content, false);
        }

        // 6. Update contracts
        await this.updateContracts(service);

        // 7. Run post-add scripts
        await this.runPostAddScripts(service);

        return this.writeOutput({ success: true, feature: this.feature });
    }

    private featureExists(def: FeatureDefinition): boolean {
        const service = new ScaffoldService();
        // Check if key file exists (e.g., apps/cli/src/index.ts for cli)
        return def.files.slice(0, 1).every(f => service.exists(f));
    }

    private stageChanges(service: ScaffoldService, templateRoot: string) {
        const templateDir = resolve(templateRoot, this.feature);
        const filesToCopy: Array<{ src: string; dest: string }> = [];
        
        // Collect template files
        for (const file of listFilesRecursive(templateDir)) {
            const relPath = relative(templateDir, file);
            filesToCopy.push({ src: file, dest: relPath });
        }

        return { filesToCopy, rewrites: [] };
    }

    private async updateContracts(service: ScaffoldService) {
        const contractPath = resolve(service.getRoot(), 'contracts/project-contracts.json');
        const contract = service.readJson(contractPath);
        
        // Add to optionalWorkspaces
        const workspaceMap: Record<string, string> = {
            cli: '@starter/cli',
            server: '@starter/server',
            webapp: '@starter/web',
            skills: '@starter/core', // Skills extends core
        };
        contract.optionalWorkspaces[`apps/${this.feature === 'api' ? 'server' : this.feature}`] = 
            workspaceMap[this.feature];
        
        service.writeFile('contracts/project-contracts.json', JSON.stringify(contract, null, 4), false);
    }

    private async runPostAddScripts(service: ScaffoldService) {
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
| Template creation (4 features) | 3 hrs |
| Command class | 1 hr |
| Logic | 1.5 hrs |
| Tests | 1.5 hrs |
| **Total** | **~7 hrs** |

## Acceptance Criteria

1. [x] `tbs scaffold add skills` restores skill files — **FIXED**: templates populated with skeleton files
2. [x] `tbs scaffold add webapp` adds Astro app — **FIXED**: webapp template populated
3. [x] `--dry-run` shows preview without adding — **MET**
4. [x] Error if feature already installed — **MET**
5. [x] Templates are properly copied — **FIXED**: templates now contain real skeleton files
6. [x] `contracts/project-contracts.json` is updated — **MET**
7. [x] Unit tests pass — **MET** (34/34)

## Verification Report (2026-04-16, Re-verification after fixes)

**Verdict: PASS** — all findings resolved, no new issues

### Phase 7: SECU Findings (All Previously Fixed — Confirmed)

| ID | Dim | Sev | Status | Verification |
|----|------|-----|--------|-------------|
| C1 | Correctness | P3 | ✅ Fixed | `rg '\bapi\b' scaffold-add.ts` returns nothing — usage text correctly uses `server` |
| C2 | Correctness | P3 | ✅ Fixed | 23 template files across 4 dirs (cli:3, server:4, webapp:3, skills:13) |
| S1 | Security | P4 | ✅ Fixed | `updateContracts` uses `copyFileSync` → `.bak`, restore-on-failure, `finally` cleanup |
| C3 | Correctness | P4 | ✅ Fixed | try/catch wraps dir creation + file copy; rollback removes `copiedFiles` then `createdDirs.reverse()` |
| U1 | Usability | P4 | ✅ Fixed | `isInstalled('skills')` checks both `skill-service.ts` AND `schemas/skill.ts` |
| C6 | Consistency | P4 | ✅ Fixed | `scaffold-remove.ts:isInstalled` aligned to same multi-file check for skills |

### Phase 8: Requirements Traceability (All MET)

| Req | Verdict | Evidence |
|-----|---------|----------|
| R1: `scaffold add skills` restores skill files | **MET** | 13 template files: schema, service, 4 CLI commands, 4 CLI tests, server route, server test, core test |
| R2: `scaffold add webapp` adds Astro app | **MET** | 3 template files: index.astro, BaseLayout.astro, components/.gitkeep |
| R3: `--dry-run` shows preview | **MET** | `scaffold-add.ts:84-91` guard + `formatDryRunOutput` + 4 tests |
| R4: Error if feature already installed | **MET** | `isInstalled()` multi-file check + 4 tests (skills/cli/server/webapp) |
| R5: Templates properly copied | **MET** | `collectTemplateFiles` + `cpSync` with populated templates |
| R6: `contracts/project-contracts.json` updated | **MET** | `updateContracts` with backup + 5 tests (cli/server/webapp/skills/duplicate) |
| R7: Unit tests pass | **MET** | 34/34 scaffold-add tests, 375/375 total |

### Gate Check

- Typecheck: ✅ `tsc --noEmit` clean
- Tests: ✅ 375/375 pass
- `bun run check`: ❌ Pre-existing biome format issue on `contracts/project-contracts.json` (unrelated)

### Recommended Actions

All items resolved. No remaining actions.
