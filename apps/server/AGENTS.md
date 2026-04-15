# AGENTS.md -- `apps/server`

## Purpose

`apps/server` is the HTTP and OpenAPI transport layer built on `@starter/contracts` and `@starter/core`.

## Structure

- Routes live in `src/routes/`.
- Middleware lives in `src/middleware/`.
- Tests live in `tests/routes/` and `tests/middleware/`.

## Rules

- Route files stay thin: parse input, call `@starter/core`, map domain results to HTTP.
- Reuse transport-safe contracts from `@starter/contracts` and domain schemas from `@starter/core` as appropriate.
- Keep middleware generic and composable.
- Do not place domain logic, SQL, or schema ownership in route handlers.
