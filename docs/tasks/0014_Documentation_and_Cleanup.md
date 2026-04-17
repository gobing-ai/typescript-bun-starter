---
name: Documentation and Cleanup
description: Documentation and Cleanup
status: Done
created_at: 2026-04-16T21:02:00.437Z
updated_at: 2026-04-16T21:02:00.437Z
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

### 1. Update Developer Spec

**File:** `docs/02_DEVELOPER_SPEC.md`

Add section for scaffold commands:

```markdown
## Scaffold Commands

The project provides CLI commands for project initialization and feature management:

### Available Commands

| Command | Description |
|---------|-------------|
| `tbs scaffold init` | Initialize project identity |
| `tbs scaffold add <feature>` | Add optional feature |
| `tbs scaffold remove <feature>` | Remove optional feature |
| `tbs scaffold list` | List available features |
| `tbs scaffold validate` | Validate project contracts |

### Usage

```bash
# Initialize project
tbs scaffold init --name my-project --scope @myorg

# Add optional features
tbs scaffold add webapp
tbs scaffold add server
tbs scaffold add cli

# Remove optional features
tbs scaffold remove webapp

# Validate
tbs scaffold validate --fix
```

> **Note:** The `skills` CRUD domain is built-in and always installed — it cannot be added or removed via scaffold commands.

### Common Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview without applying changes |
| `--json` | JSON output (for agent mode) |
```

### 2. Update User Manual

**File:** `docs/03_USER_MANUAL.md`

Add scaffold commands to quick start:

```markdown
## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/your-org/your-project.git
cd your-project
bun install
```

### 2. Initialize Project

```bash
tbs scaffold init --name your-project --scope @yourorg
```

### 3. Add/Remove Features

```bash
# List available features
tbs scaffold list

# Add optional features
tbs scaffold add webapp
tbs scaffold add server

# Remove optional features
tbs scaffold remove webapp
```

> **Note:** The `skills` CRUD domain is built-in and always installed.

### 4. Start Development

```bash
bun run dev:all  # Start server and web
```
```

### 3. Update README

**File:** `README.md`

Add scaffold section:

```markdown
## Quick Start

```bash
# Clone
git clone https://github.com/gobing-ai/typescript-bun-starter.git
cd typescript-bun-starter

# Install
bun install

# Initialize (customize for your project)
tbs scaffold init --name my-project --scope @myorg

# Start developing
bun run dev:all
```

### Scaffold Commands

Use `tbs scaffold` to manage project features:

- `tbs scaffold init` - Initialize project identity
- `tbs scaffold add <feature>` - Add optional features
- `tbs scaffold remove <feature>` - Remove unused features
- `tbs scaffold list` - Show available features
- `tbs scaffold validate` - Validate project contracts

Run `tbs scaffold --help` for more options.
```

### 4. Deprecate Old Scripts

**File:** `scripts/bootstrap-project.ts`

Add deprecation warning at top:

```typescript
#!/usr/bin/env bun
/**
 * @deprecated Use `tbs scaffold init` instead.
 *
 * This script will be removed in v1.0.0.
 * Run `tbs scaffold init` for equivalent functionality.
 */
```

**File:** `scripts/clean-demo.ts`

Add deprecation warning:

```typescript
#!/usr/bin/env bun
/**
 * @deprecated Use `tbs scaffold init` to re-initialize project identity.
 *
 * This script will be removed in v1.0.0.
 * Run `tbs scaffold init` for equivalent functionality.
 */
```

### 5. Update Package.json Scripts

**File:** `package.json`

Add deprecation notes to scripts:

```json
{
  "scripts": {
    "bootstrap": "echo 'Deprecated: Use tbs scaffold init instead' && bun run scripts/bootstrap-project.ts",
    "clean-demo": "echo 'Deprecated: Use tbs scaffold remove <feature> instead' && bun run scripts/clean-demo.ts"
  }
}
```

## Dependencies

| Task | Dependency |
|------|------------|
| 0007-0013 | Required (all commands must be done) |

## Estimation

| Subtask | Effort |
|---------|--------|
| Developer Spec | 30 min |
| User Manual | 30 min |
| README | 20 min |
| Deprecation warnings | 15 min |
| **Total** | **~1.5 hrs** |

## Acceptance Criteria

1. [ ] Developer Spec updated with scaffold documentation
2. [ ] User Manual updated with quick start
3. [ ] README has scaffold section
4. [ ] Old scripts have deprecation warnings
5. [ ] `bun run check` passes
