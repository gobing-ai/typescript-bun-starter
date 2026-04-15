# AGENTS.md -- `packages/contracts`

## Purpose

`packages/contracts` is the shared transport-safe contract layer.

## Structure

- `src/` holds cross-tier DTOs, API envelopes, and other transport-safe shared contracts.
- Keep public exports in `src/index.ts`.

## Rules

- Do not import from `apps/*`.
- Keep this package runtime-light and transport-safe.
- Do not place domain services, DB adapters, or framework handlers here.
- Prefer stable request/response contracts and shared DTOs over framework-specific types.
