---
name: Scaffold Command Infrastructure
description: Scaffold Command Infrastructure
status: Done
created_at: 2026-04-16T21:02:00.307Z
updated_at: 2026-04-16T21:02:00.307Z
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

Create the foundational infrastructure for scaffold commands: directory structure, base command class, shared types, and scaffold service.

## Requirements

### 1. Create Directory Structure

Create `apps/cli/src/commands/scaffold/` directory with:
- `index.ts` — barrel export
- `base-scaffold-command.ts` — base class
- `types/` — shared type definitions
- `services/` — scaffold service
- `features/` — feature registry and handlers

### 2. Base Command Class

**File:** `apps/cli/src/commands/scaffold/base-scaffold-command.ts`

```typescript
import { Command, Option } from 'clipanion';

/**
 * Base class for all scaffold commands.
 * Provides shared options and utility methods.
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

    /**
     * Preview files that would change (for dry-run)
     */
    protected formatDryRunPreview(files: string[]): string {
        return files.length === 0 
            ? 'No changes needed.'
            : `Files that would change:\n${files.map(f => `  - ${f}`).join('\n')}`;
    }
}
```

### 3. Shared Types

**File:** `apps/cli/src/commands/scaffold/types/scaffold.ts`

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

export interface FeatureDefinition {
    name: string;
    description: string;
    files: string[];
    rewrites: Record<string, string>;
    dependencies?: string[];
    optional?: boolean;
}

export type ScaffoldResult = 
    | { ok: true; filesChanged: string[] }
    | { ok: false; error: string };
```

### 4. Scaffold Service

**File:** `apps/cli/src/commands/scaffold/services/scaffold-service.ts`

```typescript
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import type { ProjectIdentity, ScaffoldOptions, ScaffoldResult, FeatureDefinition } from '../types/scaffold';

export class ScaffoldService {
    private root: string;

    constructor(root?: string) {
        this.root = root ?? resolve(import.meta.dir, '../../../../../../..');
    }

    /**
     * Get project root path
     */
    getRoot(): string {
        return this.root;
    }

    /**
     * Read JSON file safely
     */
    readJson<T>(path: string): T {
        return JSON.parse(readFileSync(path, 'utf8')) as T;
    }

    /**
     * Write file with dry-run support
     */
    writeFile(relPath: string, content: string, dryRun: boolean): void {
        if (dryRun) {
            return;
        }
        writeFileSync(resolve(this.root, relPath), content);
    }

    /**
     * Delete file with dry-run support
     */
    deleteFile(relPath: string, dryRun: boolean): void {
        if (dryRun) {
            return;
        }
        rmSync(resolve(this.root, relPath), { force: true });
    }

    /**
     * Check if path exists
     */
    exists(relPath: string): boolean {
        return existsSync(resolve(this.root, relPath));
    }
}
```

### 5. Barrel Export

**File:** `apps/cli/src/commands/scaffold/index.ts`

```typescript
export { BaseScaffoldCommand } from './base-scaffold-command';
export * from './types/scaffold';
export { ScaffoldService } from './services/scaffold-service';
```

## Dependencies

- None (this is the foundation)

## Estimation

| Subtask | Effort |
|---------|--------|
| Directory structure | 15 min |
| Base command class | 30 min |
| Shared types | 20 min |
| Scaffold service | 1 hr |
| Tests | 1 hr |
| **Total** | **~3 hrs** |

## Acceptance Criteria

1. [ ] `apps/cli/src/commands/scaffold/` directory exists with proper structure
2. [ ] `BaseScaffoldCommand` provides `--dry-run` and `--json` options
3. [ ] Shared types are properly exported
4. [ ] `ScaffoldService` provides common file operations
5. [ ] Unit tests pass for base class and service
