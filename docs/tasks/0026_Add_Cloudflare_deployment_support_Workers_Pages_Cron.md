---
name: "Add Cloudflare deployment support (Workers, Pages, Cron)"
description: "Add Cloudflare deployment support (Workers, Pages, Cron)"
status: Done
created_at: 2026-05-01T17:30:55.855Z
updated_at: 2026-05-01T18:10:54.328Z
folder: docs/tasks2
type: task
impl_progress:
  planning: pending
  design: pending
  implementation: pending
  review: pending
  testing: pending
---

## 0026. "Add Cloudflare deployment support (Workers, Pages, Cron)"

### Background

The project already ships a Cloudflare D1 database adapter alongside Bun SQLite, and a scheduler abstraction with CloudflareSchedulerAdapter, NodeSchedulerAdapter (node-cron), and NoOpSchedulerAdapter — all selectable via APP_MODE env var. However, the Cloudflare deployment story is incomplete: the scheduler abstraction is orphaned (no app calls initScheduler() or registers cron jobs), no scheduled() handler is exported for CF Cron Triggers, no wrangler.toml source file exists for the server Worker, no deployment scripts exist, scaffold templates do not generate CF config, and docs make no mention of CF as a deployment target.


### Requirements

## Requirements

- [x] **R1 — Server → Cloudflare Workers**: wrangler.toml with D1 binding, KV (SESSION) binding, cron triggers, and environment sections → **MET** | Evidence: `apps/server/wrangler.toml` (lines 1-49)
- [x] **R2 — Wire initScheduler() into server**: scheduled.ts registers jobs via CloudflareSchedulerAdapter → **MET** | Evidence: `apps/server/src/scheduled.ts` (lines 20-71)
- [x] **R3 — Export scheduled(event, env, ctx) handler**: co-exported from index.ts → **MET** | Evidence: `apps/server/src/index.ts` (line 307: `export { scheduled } from './scheduled'`)
- [x] **R4 — deploy:server and dev:server:cf scripts**: → **MET** | Evidence: root `package.json` (deploy:server, dev:server:cf), `apps/server/package.json` (deploy, dev:cf)
- [x] **R5 — Dual-mode support (Bun + CF Worker)**: same entry works with bun --hot and wrangler deploy → **MET** | Evidence: `apps/server/src/index.ts` default export + named scheduled export
- [x] **R6 — Web → Cloudflare Pages deploy:web script**: → **MET** | Evidence: root `package.json` (deploy:web), `apps/web/package.json` (deploy: `astro build && wrangler pages deploy dist/`)
- [x] **R7 — Web wrangler.toml for Pages config**: → **MET** | Evidence: `apps/web/wrangler.toml`
- [x] **R8 — _headers and _routes.json for CF Pages routing**: → **MET** | Evidence: `apps/web/public/_headers`, `apps/web/public/_routes.json`
- [x] **R9 — Document static-vs-SSR switch**: → **MET** | Evidence: README.md Cloudflare Deployment section, wrangler.toml comment
- [x] **R10 — Scaffold wrangler.toml templates**: → **MET** | Evidence: `scripts/scaffold/templates/server/apps/server/wrangler.toml`, `scripts/scaffold/templates/webapp/apps/web/wrangler.toml`
- [x] **R11 — Scaffold scheduled.ts template**: → **MET** | Evidence: `scripts/scaffold/templates/server/apps/server/src/scheduled.ts`
- [x] **R12 — Update SCAFFOLD_FEATURES registry**: → **MET** | Evidence: `apps/cli/src/commands/scaffold/features/registry.ts` (added scheduled.ts, wrangler.toml to server; _headers, _routes.json, wrangler.toml to webapp)
- [x] **R13 — ARCHITECTURE_SPEC.md Cloudflare runtime section**: → **MET** | Evidence: `docs/01_ARCHITECTURE_SPEC.md` (Cloudflare Deployment subsection under 4. Runtime Model)
- [x] **R14 — README.md deploy quickstart**: → **MET** | Evidence: `README.md` (Cloudflare Deployment section with prerequisites, server, and web instructions)

**Verdict:** PASS — All 14 requirements MET.


### Q&A

### Plan

#### Phase 1 — Server Worker deployment ✓
1. Create `apps/server/wrangler.toml` — Worker name, D1 binding, KV (SESSION) binding, cron triggers, environment sections
2. Create `apps/server/src/scheduled.ts` — initScheduler({ mode: 'cloudflare' }), job registration, scheduled() handler
3. Update server entry to co-export `scheduled` alongside `fetch`
4. Add scripts: `deploy:server`, `dev:server:cf`

#### Phase 2 — Web Pages deployment ✓
5. Create `apps/web/public/_headers` and `_routes.json`
6. Add scripts: `deploy:web`, `preview:web:cf`
7. Create `apps/web/wrangler.toml` for Pages config

#### Phase 3 — Scaffold + docs ✓
8. Create template `wrangler.toml` files for server and webapp
9. Create template `scheduled.ts`, `_headers`, `_routes.json`
10. Update SCAFFOLD_FEATURES registry
11. Update ARCHITECTURE_SPEC.md with Cloudflare runtime section
12. Update README.md with deploy quickstart

### Design

Three-phase implementation, ordered by dependency:

**Phase 1 — Server Worker deployment**
1. `apps/server/wrangler.toml`: worker name (`starter-server`), D1 binding, KV (SESSION) binding, cron triggers as commented examples, compatibility_date, `[env.production]` / `[env.staging]` sections
2. `apps/server/src/scheduled.ts`: `initScheduler({ mode: 'cloudflare' })`, job registration, `scheduled()` handler
3. Server entry updated to co-export `scheduled` alongside `fetch`
4. Scripts: `deploy:server`, `dev:server:cf`

**Phase 2 — Web Pages deployment**
5. `apps/web/public/_headers` and `_routes.json`
6. Scripts: `deploy:web`, `preview:web:cf`
7. Optional `apps/web/wrangler.toml` for explicit Pages config

**Phase 3 — Scaffold + docs**
8. Template `wrangler.toml` files for server and webapp
9. Registry update for new files
10. Architecture spec and README updates


### Solution

### Solution

#### Files Changed (17 files, 383 insertions, 3 deletions)

**Server Worker (Phase 1)**
- [x] `apps/server/wrangler.toml` — Worker config: D1 binding, KV (SESSION) binding, cron triggers (commented), env.production/staging sections
- [x] `apps/server/src/scheduled.ts` — CloudflareSchedulerAdapter registry + `scheduled(event, env, ctx)` handler with cron dispatch
- [x] `apps/server/src/index.ts` — Co-exports `scheduled` from `./scheduled` (CF Workers named-export pattern)
- [x] `apps/server/package.json` — Added `wrangler` devDependency, `dev:cf` and `deploy` scripts
- [x] `package.json` — Added `deploy:server`, `deploy:web`, `dev:server:cf`, `preview:web:cf` scripts

**Web Pages (Phase 2)**
- [x] `apps/web/wrangler.toml` — Pages config with build output dir and env sections
- [x] `apps/web/public/_headers` — CF Pages security headers + cache policy for hashed assets
- [x] `apps/web/public/_routes.json` — CF Pages routing rules (include /*, exclude /_assets/*)
- [x] `apps/web/package.json` — Added `wrangler` devDependency, `deploy` and `preview:cf` scripts

**Scaffold Templates (Phase 3)**
- [x] `scripts/scaffold/templates/server/apps/server/wrangler.toml` — Templated Worker config
- [x] `scripts/scaffold/templates/server/apps/server/src/scheduled.ts` — Templated cron handler
- [x] `scripts/scaffold/templates/webapp/apps/web/wrangler.toml` — Templated Pages config
- [x] `scripts/scaffold/templates/webapp/apps/web/public/_headers` — Templated security headers
- [x] `scripts/scaffold/templates/webapp/apps/web/public/_routes.json` — Templated routing rules
- [x] `apps/cli/src/commands/scaffold/features/registry.ts` — Updated SCAFFOLD_FEATURES for server (+scheduled.ts, +wrangler.toml) and webapp (+_headers, +_routes.json, +wrangler.toml)

**Documentation**
- [x] `docs/01_ARCHITECTURE_SPEC.md` — Added Cloudflare Deployment subsection under Runtime Model
- [x] `README.md` — Added Cloudflare Deployment quickstart section with prerequisites and deploy commands

### Review — 2026-05-01

**Status:** 0 findings  
**Scope:** Cloudflare deployment support (Workers, Pages, Cron) — apps/server/, apps/web/, scripts/scaffold/, docs/  
**Mode:** verify  
**Channel:** inline  
**Gate:** `bun run check` → pass

**Verdict:** PASS — No SECU findings. All 14 requirements MET. Code is production-clean: no security issues, correct error handling, proper test coverage, clear documentation.

