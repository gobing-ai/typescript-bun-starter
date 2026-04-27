---
description: Migrate starter conventions into a target project
argument-hint: [target-project-path]
allowed-tools: Read, Write, Edit, Bash(bun:*)
---

Apply the current starter to an existing project via npm package migration.

## Usage

```
/apply-migration [target-project-path]
```

If no path is given, the agent should ask the user for the target project directory.

## Workflow

Execute these phases in order. Stop and ask for confirmation at each phase boundary.

### Phase 1: Install Starter Package

1. Resolve the target project path (absolute).
2. Verify the target directory exists and contains a `package.json`.
3. Install the starter as an npm package into the target project:

   ```bash
   cd <target-project> && npm install @gobing-ai/typescript-bun-starter --save-dev
   ```

   If the user prefers `bun add` instead of `npm install`, adapt accordingly. Record the installed package path — it will be at `<target-project>/node_modules/@gobing-ai/typescript-bun-starter/`.

4. Report the installed version to the user.

### Phase 2: Inventory and Diff

Run the migration analysis script:

```bash
bun run scripts/apply-migration.ts --source <starter-path> --target <target-project-path> --analyze
```

Where `<starter-path>` is `node_modules/@gobing-ai/typescript-bun-starter` inside the target project.

This script produces a structured report with three categories of files:

- **New files** — present in the starter but absent from the target. Safe to copy.
- **Identical files** — present in both and content matches. No action needed.
- **Modified files** — present in both but content differs. Requires user decision.

For each **modified file**, the script shows a unified diff. Present the diff to the user and ask:

- **Overwrite**: Replace the target file with the starter version.
- **Keep**: Leave the target file unchanged.
- **Merge**: Open a 3-way merge session (manual or assisted).
- **Skip**: Defer this file for later.

Batch the questions: group modified files by directory/workspace, present up to 5 at a time, and let the user answer per file or apply a blanket decision for the group.

### Phase 3: Apply Changes

For files the user approved (new files and overwrite decisions):

```bash
bun run scripts/apply-migration.ts --source <starter-path> --target <target-project-path> --apply --plan <plan-file>
```

The plan file is a JSON file written during Phase 2 that records the user's decisions. The script copies/overwrites files according to the plan.

After applying:

1. Show a summary of all changes made.
2. List any files that were skipped or deferred.

### Phase 4: Verify

Run verification in the target project:

```bash
cd <target-project> && bun install && bun run typecheck && bun run test
```

If `bun run check` exists, use that instead. Report results. If there are failures, help the user resolve them — common issues include import path mismatches, missing workspace dependencies, or config drift.

### Phase 5: Cleanup

Offer to:

1. Remove the starter package from `node_modules` and `package.json` devDependencies (it was only needed for the migration).
2. Commit the migration changes with a descriptive message like `chore: migrate to @gobing-ai/typescript-bun-starter patterns`.

## Excluded Paths

The following paths from the starter should NOT be migrated:

- `.git/`
- `node_modules/`
- `coverage/`
- `dist/`
- `.astro/`
- `bun.lock`
- `package-lock.json`
- `docs/tasks/` — these are starter-specific task files
- `docs/.tasks/` — starter task management config

## Notes

- The target project may or may not have been created from this starter. The command handles both cases.
- Always prefer non-destructive operations. Never overwrite without explicit user approval.
- If the target project uses a different package manager (npm, pnpm, yarn), adapt the install/uninstall commands accordingly.
- The migration script at `scripts/apply-migration.ts` handles the mechanical diff and copy logic. This command file defines the interactive agent workflow.
