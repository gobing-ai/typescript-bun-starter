---
name: Implement scaffold list Command
description: Implement scaffold list Command
status: Done
created_at: 2026-04-16T21:02:00.400Z
updated_at: 2026-04-16T21:02:00.400Z
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
tbs scaffold list [options]

Options:
  --json                  JSON output mode
  --help                  Show help
```

### Output Format

**Text Mode:**
```
Available Scaffold Features
===========================

Required (always installed):
  [x] contracts    Shared contracts and DTOs
  [x] core         Core domain and data layer

Optional (install/remove):
  [x] cli          Clipanion CLI tool
  [x] server       Hono REST API server
  [x] webapp       Astro web application
  [ ] skills       Skill management domain

Usage:
  tbs scaffold add <feature>    Install a feature
  tbs scaffold remove <feature> Remove a feature
```

**JSON Mode:**
```json
{
  "required": [
    { "name": "contracts", "description": "Shared contracts and DTOs", "installed": true },
    { "name": "core", "description": "Core domain and data layer", "installed": true }
  ],
  "optional": [
    { "name": "cli", "description": "Clipanion CLI tool", "installed": true },
    { "name": "server", "description": "Hono REST API server", "installed": false },
    { "name": "webapp", "description": "Astro web application", "installed": false },
    { "name": "skills", "description": "Skill management domain", "installed": false }
  ]
}
```

### Implementation

**File:** `apps/cli/src/commands/scaffold/scaffold-list.ts`

```typescript
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import { SCAFFOLD_FEATURES, REQUIRED_FEATURES, OPTIONAL_FEATURES } from './features/registry';

export class ScaffoldListCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'list']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'List available scaffold features and their status',
        details: `
            Show all available scaffold features (required and optional) with their
            installation status.
            
            Required features are always installed and cannot be removed.
            Optional features can be added or removed as needed.
        `,
        examples: [
            ['List all features', 'tbs scaffold list'],
            ['JSON output', 'tbs scaffold list --json'],
        ],
    });

    async execute(): Promise<number> {
        const service = new ScaffoldService();

        const required = REQUIRED_FEATURES.map(name => ({
            name,
            description: SCAFFOLD_FEATURES[name]?.description ?? name,
            installed: true, // Required features are always installed
        }));

        const optional = OPTIONAL_FEATURES.map(name => ({
            name,
            description: SCAFFOLD_FEATURES[name]?.description ?? name,
            installed: this.isInstalled(name, service),
        }));

        if (this.json) {
            return this.writeOutput({ required, optional });
        }

        // Text output
        let output = 'Available Scaffold Features\n';
        output += '===========================\n\n';

        output += 'Required (always installed):\n';
        for (const feature of required) {
            output += `  [x] ${feature.name.padEnd(12)} ${feature.description}\n`;
        }

        output += '\nOptional (install/remove):\n';
        for (const feature of optional) {
            const status = feature.installed ? 'x' : ' ';
            output += `  [${status}] ${feature.name.padEnd(12)} ${feature.description}\n`;
        }

        output += '\nUsage:\n';
        output += '  tbs scaffold add <feature>    Install a feature\n';
        output += '  tbs scaffold remove <feature> Remove a feature\n';

        this.context.stdout.write(`${output}\n`);
        return 0;
    }

    private isInstalled(feature: string, service: ScaffoldService): boolean {
        const workspaceMap: Record<string, string> = {
            cli: 'apps/cli/src/index.ts',
            server: 'apps/server/src/index.ts',
            webapp: 'apps/web/src/pages/index.astro',
            skills: 'packages/core/src/schemas/skill.ts',
        };

        const keyFile = workspaceMap[feature];
        return keyFile ? service.exists(keyFile) : false;
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
| Command class | 30 min |
| Tests | 30 min |
| **Total** | **~1 hr** |

## Acceptance Criteria

1. [ ] `tbs scaffold list` shows all features with status
2. [ ] Required features always show as installed
3. [ ] `--json` outputs valid JSON
4. [ ] Installed status matches actual files
5. [ ] Unit tests pass
