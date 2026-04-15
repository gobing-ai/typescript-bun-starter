---
name: Astro WebApp Integration
description: Add optional Tier 3 web-app skeleton using Astro 5 SSG with React islands, Tailwind, and base-ui for Cloudflare Pages deployment
status: Completed
created_at: 2026-04-14T23:53:53.903Z
updated_at: 2026-04-15T00:35:00.000Z
folder: docs/tasks
type: task
preset: "standard"
profile: "fullstack-frontend"
impl_progress:
  planning: completed
  design: completed
  implementation: completed
  review: completed
  testing: completed
---

## 0004. Astro WebApp Integration

### Background

The TypeScript Bun Starter currently supports CLI + API tiers (Tier 1-2). Users have requested an optional **WebApp skeleton** (Tier 3) to enable rapid development of:
- Dashboards with interactive components
- Marketing landing pages with fast SSG performance

**Deployment target**: Cloudflare Pages (requires SSG output)

### Requirements

#### Core Architecture

1. **Add `apps/web` as Astro SSG application**
   - Framework: Astro 5.x with React integration
   - Rendering: SSG (Static Site Generation) for Cloudflare Pages deployment
   - Island architecture: React for interactive components
   - Output: `dist/client/` for static files

2. **Styling System**
   - Tailwind CSS v4 for utility-first styling
   - `@base-ui/react` as default UI component library

3. **Hybrid Architecture**
   - Astro builds to static output (`dist/client/`)
   - Hono server (`apps/server`) serves static files via middleware
   - API routes remain on `/api/*`
   - Same port (3000), unified server in production

4. **Monorepo Integration**
   - Share `packages/core` (types, schemas) with Astro web-app
   - Shared Zod schemas for type-safe API calls
   - Consistent TypeScript strict mode

5. **Cloudflare Pages Deployment**
   - Use `@astrojs/cloudflare` adapter
   - Static output compatible with Cloudflare Pages
   - Environment variables handling for `PUBLIC_*` vars

#### User Stories

- **US-1**: Developer can scaffold a new web-app with `bun run add:web`
- **US-2**: Dashboard pages render statically with React islands for interactivity
- **US-3**: Marketing landing pages load fast (minimal JS, SSG)
- **US-4**: Web-app calls API using shared types from `packages/core`
- **US-5**: Production build deploys to Cloudflare Pages

#### Out of Scope

- SSR mode (stick with SSG for Cloudflare Pages)
- Multiple island frameworks (React only)
- Direct database access from Astro (use API layer)

### Q&A

**Q: Why Astro instead of Next.js or Vite?**
A: Astro's Islands Architecture provides zero-JS by default with selective hydration. Better for landing pages and dashboards where most content is static.

**Q: Why SSG for Cloudflare Pages?**
A: Cloudflare Pages excels at serving static files from edge. SSG produces static HTML that deploys instantly and caches globally.

**Q: How does dev mode work?**
A: Two options:
- `bun run dev:web` → Astro dev server on port 4321 (API calls to localhost:3000)
- `bun run dev:all` → Both Astro (4321) + Hono (3000) with static serving

**Q: How does Tailwind v4 CSS-first configuration work?**
A: Tailwind v4 uses `@import "tailwindcss"` in CSS with `@theme` blocks for customization. No `tailwind.config.mjs` required for basic setup, but v4 supports it for backward compatibility. For this project, use the CSS-first approach with a minimal `tailwind.config.mjs` only if custom theme tokens are needed.

**Q: How does monorepo workspace configuration work?**
A: Add `"apps/web"` to the `workspace.packages` array in root `package.json`. Astro will auto-detect shared packages via `astro sync` and TypeScript project references work automatically through the root `tsconfig.json`.

**Q: How are React islands error states handled?**
A: Wrap islands in `<Suspense>` with fallback components. Use error boundaries within React components for API failures. The landing page and dashboard layouts should include a global error boundary.

**Q: How is the 404 page handled?**
A: Create `apps/web/src/pages/404.astro` with a custom error page. For SPA fallback on the Hono server, configure middleware to serve `dist/client/404.html` for unmatched routes (except API paths).

### Design

```
typescript-bun-starter/
├── packages/
│   └── core/                    # Shared: types, schemas, services
├── apps/
│   ├── cli/                     # Clipanion CLI (unchanged)
│   ├── server/                  # Hono API + static middleware
│   │   └── src/
│   │       └── index.ts         # Modified: serveStatic from '../web/dist/client'
│   └── web/                     # NEW: Astro SSG
│       ├── src/
│       │   ├── pages/           # File-based routing (.astro)
│       │   │   ├── index.astro   # Landing page
│       │   │   └── dashboard.astro
│       │   ├── components/       # .astro + React islands
│       │   │   └── Counter.tsx   # React island example
│       │   ├── layouts/         # Page layouts
│       │   │   └── BaseLayout.astro
│       │   ├── lib/            # API client, utilities
│       │   │   └── api-client.ts
│       │   └── env.d.ts
│       ├── public/             # Static assets
│       ├── astro.config.mjs
│       ├── tailwind.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── dist/
│   ├── client/                  # Astro build output (served by Hono)
│   └── tbs                      # CLI binary
```

### Solution

[To be added by specialist during design phase]

### Plan

#### Step Dependencies

| Phase | Steps | Can Run In Parallel |
|-------|-------|---------------------|
| Phase A | 1, 2 | Steps 1 & 2 (scaffold + adapter) can run sequentially but Step 2 depends on Step 1 |
| Phase B | 3, 4 | Steps 3 & 4 (landing + dashboard) can run in parallel after Step 1 |
| Phase C | 5, 6, 7 | Steps 5-7 (integration) must run after Steps 1-4 complete |
| Phase D | 8 | Step 8 (docs) runs last after all implementation |

#### Step 1: Scaffold `apps/web` (Medium effort)
- [ ] Create `apps/web/package.json` with Astro 5.x, React, Tailwind, base-ui
- [ ] Create `apps/web/tsconfig.json` with strict TypeScript
- [ ] Create `apps/web/astro.config.mjs` with React + Tailwind integrations
- [ ] Create `apps/web/tailwind.config.mjs`
- [ ] Install dependencies

#### Step 2: Configure Cloudflare adapter (Low effort)
- [ ] Install `@astrojs/cloudflare`
- [ ] Configure adapter in `astro.config.mjs`
- [ ] Set output to `static`

#### Step 3: Create sample landing page (Low effort)
- [ ] Create `apps/web/src/layouts/BaseLayout.astro`
- [ ] Create `apps/web/src/pages/index.astro` with Tailwind + base-ui components
- [ ] Add hero section, features grid, CTA

#### Step 4: Create sample dashboard page (Low effort)
- [ ] Create `apps/web/src/pages/dashboard.astro`
- [ ] Create `apps/web/src/components/Counter.tsx` (React island)
- [ ] Add `client:load` directive for interactivity

#### Step 5: Integrate with Hono server (Medium effort)
- [ ] Modify `apps/server/src/index.ts` to serve static files from `dist/client/`
- [ ] Add SPA fallback for client-side routing
- [ ] Test unified dev experience

#### Step 6: Add API client utilities (Low effort)
- [ ] Create `apps/web/src/lib/api-client.ts`
- [ ] Import shared schemas from `packages/core`
- [ ] Add typed fetch wrappers

#### Step 7: Update root configs (Low effort)
- [ ] Add web scripts to `package.json`
- [ ] Update `biome.json` to include `apps/web`
- [ ] Update root `tsconfig.json` references

#### Step 8: Documentation (Low effort)
- [ ] Add `bun run dev:web` and `bun run build:web` commands
- [ ] Document Cloudflare Pages deployment in README
- [ ] Add Tier 3 usage examples

### Review

[To be added during review phase]

### Testing

#### Non-Functional Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial JS bundle (landing page) | < 50KB gzipped | `astro build` output analysis |
| LCP on simulated 3G | < 2.5s | Lighthouse CI |
| TypeScript | `strict: true`, zero errors | `tsc --noEmit` |
| Lighthouse Performance | ≥ 90 | Cloudflare Pages analytics |

#### Error Handling Requirements

| Scenario | Expected Behavior |
|----------|-------------------|
| Unknown route | Custom 404.astro page renders |
| React island API failure | Toast notification with retry option |
| Network offline during island load | Graceful "offline" state |
| API returns 4xx/5xx | User-friendly error display in island |

#### Acceptance Criteria (Given/When/Then Format)

| ID | Criterion |
|----|-----------|
| AC-1 | **Given** a developer runs `bun run dev:web`, **when** the command completes, **then** Astro dev server MUST be accessible on port **4321** and respond to `GET /` within 5 seconds |
| AC-2 | **Given** `bun run build:web` is executed, **when** the build completes, **then** static files MUST be present in `dist/client/` with `index.html` at root |
| AC-3 | **Given** the Hono server is running, **when** a user visits port 3000, **then** static Astro pages MUST be served and client-side routing MUST work |
| AC-4 | **Given** a user visits `/dashboard`, **when** the page loads, **then** the React Counter island MUST be interactive within 100ms of hydration |
| AC-5 | **Given** a user visits `/`, **when** the landing page loads, **then** it MUST render with Tailwind styles and base-ui components, with **< 50KB JS** gzipped |
| AC-6 | **Given** the web-app makes an API call, **when** the response arrives, **then** TypeScript types from `packages/core` MUST validate the response without errors |
| AC-7 | **Given** `bun run check` is executed, **when** linting and typechecking complete, **then** there MUST be zero errors |
| AC-8 | **Given** the project is deployed to Cloudflare Pages, **when** a preview build runs, **then** it MUST complete successfully with zero warnings |

#### Verification Checklist

- [ ] `bun run dev:web` starts Astro on port 4321
- [ ] `bun run build:web` produces static files in `dist/client/`
- [ ] `bun run dev:server` serves static Astro pages on port 3000
- [ ] Dashboard page loads with React island interactivity
- [ ] Landing page renders with Tailwind + base-ui components
- [ ] API calls from web-app use shared `packages/core` types
- [ ] `bun run check` passes (lint, typecheck, test)
- [ ] Cloudflare Pages preview builds successfully
- [ ] Landing page JS bundle < 50KB gzipped
- [ ] Custom 404 page renders for unknown routes

### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References

- [Astro 5 Documentation](https://docs.astro.build/)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Tailwind CSS](https://tailwindcss.com/)
- [base-ui React](https://base-ui.com/)
- [Cloudflare Pages Deployment](https://developers.cloudflare.com/pages/)
