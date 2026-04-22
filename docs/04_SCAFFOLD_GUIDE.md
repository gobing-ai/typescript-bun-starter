# Scaffold Guide

This guide holds the operational detail that does not belong on the README landing page.

## Starter Profiles

| Profile | Included workspaces | How to reach it |
| --- | --- | --- |
| CLI + API + Web | `apps/cli`, `apps/server`, `apps/web` | default checkout |
| CLI + API | `apps/cli`, `apps/server` | `bun run scaffold:remove -- webapp` |
| CLI only | `apps/cli` | `bun run scaffold:remove -- webapp` then `bun run scaffold:remove -- server` |

## Source Workflow

```bash
bun install
bun run scaffold:init -- --name my-project --scope @acme --title "My Project"
bun run scaffold:list
bun run scaffold:validate
```

## Compiled Binary Workflow

```bash
bun run build:cli
./dist/tbs scaffold init --name my-project --scope @acme --title "My Project"
./dist/tbs scaffold list
./dist/tbs scaffold validate --fix
```

## Command Reference

```bash
bun run scaffold:init -- --name my-project --scope @acme
bun run scaffold:add -- server
bun run scaffold:add -- webapp
bun run scaffold:remove -- server
bun run scaffold:remove -- webapp
bun run scaffold:list
bun run scaffold:validate
bun run scaffold:validate -- --fix
```

## Local Development

```bash
bun run dev:cli
bun run dev:server
bun run dev:web
bun run dev:all
```

## Verification

```bash
bun run check
bun run smoke:generated
```

Use `bun run smoke:generated` before merging scaffold-heavy changes. It is the closest thing to testing the real product, because the product is the generated repo.
