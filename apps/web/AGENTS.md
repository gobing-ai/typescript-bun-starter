# AGENTS.md -- `apps/web`

## Purpose

`apps/web` is the browser-facing tier and consumes public APIs and shared types.

## Structure

- Pages live in `src/pages/` and use lowercase or route-style names.
- Reusable UI components live in `src/components/` and use PascalCase filenames.
- Layouts live in `src/layouts/` and use PascalCase filenames.
- Browser-safe utilities and API clients live in `src/lib/`.
- Tests live in `tests/` and mirror the relevant source area.

## Rules

- Do not import server-only code or database code into the web app.
- Keep data access in `src/lib/` or dedicated client helpers, not scattered across UI files.
- Prefer shared types from `@starter/core` when crossing API boundaries.
- UI components should stay presentation-focused; data fetching and transport details belong in client helpers or page-level orchestration.
