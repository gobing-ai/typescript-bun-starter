# AGENTS.md -- `apps/server`

## Purpose

`apps/server` is the HTTP and OpenAPI transport layer for `@starter/core`.

## Structure

- Routes live in `src/routes/`.
- Middleware lives in `src/middleware/`.
- Tests live in `tests/routes/` and `tests/middleware/`.

## Rules

- Route files stay thin: parse input, call `@starter/core`, map domain results to HTTP.
- Reuse schemas from `@starter/core` for request and response contracts.
- Keep middleware generic and composable.
- Do not place domain logic, SQL, or schema ownership in route handlers.
