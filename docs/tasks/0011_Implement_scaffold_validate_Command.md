---
name: Implement scaffold validate Command
description: Implement scaffold validate Command
status: Done
created_at: 2026-04-16T21:02:00.381Z
updated_at: 2026-04-16T21:02:00.381Z
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
tbs scaffold validate [options]

Options:
  --fix                   Auto-fix fixable issues
  --json                  JSON output mode
  --help                  Show help
```

### Logic to Migrate from `check-contracts.ts`

The `check-contracts.ts` script validates:
1. Required workspaces exist
2. Optional workspaces match contract
3. Workspace dependency rules are respected
4. Root scripts are present
5. File naming rules are followed
6. Instruction files are in sync

### Implementation

**File:** `apps/cli/src/commands/scaffold/scaffold-validate.ts`

```typescript
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import type { ScaffoldResult } from './types/scaffold';

export class ScaffoldValidateCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'validate']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Validate project contracts and structure',
        details: `
            Validate that the project follows all contracts:
            - Required workspaces exist
            - Optional workspaces match contract
            - Workspace dependency rules are respected
            - Root scripts are present
            - File naming rules are followed
            - Instruction files are in sync
            
            Use --fix to automatically fix fixable issues.
        `,
        examples: [
            ['Validate project', 'tbs scaffold validate'],
            ['Validate with auto-fix', 'tbs scaffold validate --fix'],
            ['JSON output', 'tbs scaffold validate --json'],
        ],
    });

    fix = Option.Boolean('--fix', false, {
        description: 'Auto-fix fixable issues',
    });

    async execute(): Promise<number> {
        const service = new ScaffoldService();
        const issues: ValidationIssue[] = [];

        // 1. Load contract
        const contract = this.loadContract(service);

        // 2. Run validations
        issues.push(...this.validateWorkspaces(service, contract));
        issues.push(...this.validateScripts(service, contract));
        issues.push(...this.validateFileNaming(service, contract));
        issues.push(...this.validateInstructions(service, contract));

        // 3. Auto-fix if requested
        if (this.fix && issues.some(i => i.fixable)) {
            await this.applyFixes(service, issues);
        }

        // 4. Output results
        if (issues.length === 0) {
            return this.writeOutput({ valid: true, message: 'Project validation passed.' });
        }

        const fixableCount = issues.filter(i => i.fixable).length;
        return this.writeOutput({
            valid: false,
            issues,
            hint: fixableCount > 0 ? `Run with --fix to auto-fix ${fixableCount} issue(s)` : undefined,
        }, issues[0].message);
    }

    private loadContract(service: ScaffoldService) {
        const path = resolve(service.getRoot(), 'contracts/project-contracts.json');
        return service.readJson<ContractFile>(path);
    }

    private validateWorkspaces(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check required workspaces
        for (const [relPath, pkgName] of Object.entries(contract.requiredWorkspaces)) {
            if (!service.exists(relPath)) {
                issues.push({
                    severity: 'error',
                    category: 'workspace',
                    message: `Required workspace missing: ${relPath}`,
                    fixable: false,
                });
            }
        }

        // Check optional workspaces
        for (const [relPath, pkgName] of Object.entries(contract.optionalWorkspaces)) {
            const exists = service.exists(relPath);
            const inPackageJson = this.workspaceInPackageJson(service, relPath);
            
            if (exists !== inPackageJson) {
                issues.push({
                    severity: 'warning',
                    category: 'workspace',
                    message: `Optional workspace ${relPath} exists but not in contract (or vice versa)`,
                    fixable: true,
                    fix: () => this.syncWorkspace(service, relPath, exists),
                });
            }
        }

        return issues;
    }

    private validateScripts(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const packageJson = service.readJson<{ scripts?: Record<string, string> }>(
            resolve(service.getRoot(), 'package.json')
        );
        const scripts = packageJson.scripts ?? {};

        for (const required of contract.requiredRootScripts) {
            if (!scripts[required]) {
                issues.push({
                    severity: 'error',
                    category: 'script',
                    message: `Required script missing: ${required}`,
                    fixable: false,
                });
            }
        }

        return issues;
    }

    private validateFileNaming(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        for (const rule of contract.fileNamingRules) {
            const files = service.listFiles(rule.pathPrefix);
            for (const file of files) {
                if (!new RegExp(rule.pattern).test(file)) {
                    issues.push({
                        severity: 'warning',
                        category: 'naming',
                        message: `File ${file} does not match pattern: ${rule.description}`,
                        fixable: true,
                        fix: () => this.renameFile(service, file, rule.pattern),
                    });
                }
            }
        }

        return issues;
    }

    private validateInstructions(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const contractVersion = service.readJson<{ version: number }>(
            resolve(service.getRoot(), 'contracts/project-contracts.json')
        );

        // Check if AGENTS.md is in sync with contract
        const agentsPath = resolve(service.getRoot(), 'AGENTS.md');
        if (!service.exists('AGENTS.md')) {
            issues.push({
                severity: 'error',
                category: 'instructions',
                message: 'AGENTS.md is missing. Run "bun run generate:instructions" to generate.',
                fixable: true,
                fix: () => service.runScript(['bun', 'run', 'generate:instructions']),
            });
        }

        return issues;
    }

    private async applyFixes(service: ScaffoldService, issues: ValidationIssue[]): Promise<void> {
        const fixable = issues.filter(i => i.fixable);
        for (const issue of fixable) {
            if (issue.fix) {
                await issue.fix();
            }
        }
    }
}

interface ValidationIssue {
    severity: 'error' | 'warning';
    category: string;
    message: string;
    fixable: boolean;
    fix?: () => Promise<void>;
}
```

## Dependencies

| Task | Dependency |
|------|------------|
| 0007 | Required (base infrastructure) |

## Estimation

| Subtask | Effort |
|---------|--------|
| Command class | 1 hr |
| Logic migration | 2 hrs |
| Tests | 1.5 hrs |
| **Total** | **~4.5 hrs** |

## Acceptance Criteria

1. [ ] `tbs scaffold validate` runs all validations
2. [ ] `tbs scaffold validate --fix` auto-fixes issues
3. [ ] JSON output includes all issues
4. [ ] Error exit code when validation fails
5. [ ] Unit tests pass
