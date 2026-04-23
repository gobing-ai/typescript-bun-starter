# AGENTS.md -- `packages/core`

## Purpose

`packages/core` is the shared business, validation, logging, and data layer.

## Structure

- `src/db/` holds adapter abstractions, client wiring, and schema definitions.
- `src/schemas/` holds hand-written Zod schemas and OpenAPI metadata.
- `src/services/` holds domain services named `<domain>-service.ts`.
- `src/types/` holds shared domain types and result helpers.
- `tests/` mirrors `src/`.

## Rules

- Do not import from `apps/*`.
- Keep services transport-agnostic: no Hono, Clipanion, Astro, or UI code in services.
- Validation belongs in schemas or service boundaries, not in callers.
- Prefer returning shared result/error types instead of transport-specific responses.
- Database access stays behind the adapter and DAO or service layer.
