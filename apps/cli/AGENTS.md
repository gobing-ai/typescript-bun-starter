# AGENTS.md -- `apps/cli`

## Purpose

`apps/cli` is the command-line transport layer for `@project/core`.

## Structure

- Commands live in `src/commands/`.
- Command filenames use `<domain>-<action>.ts` and should match the CLI surface.
- Tests live in `tests/commands/` and mirror `src/commands/`.

## Rules

- Keep commands thin and delegate business logic to `@project/core`.
- Support machine-readable output when the command surface already exposes `--json`.
- Do not embed SQL, schema definitions, or domain policy in command files.
- Shared CLI wiring belongs in `src/index.ts` or `src/config.ts`, not duplicated per command.
