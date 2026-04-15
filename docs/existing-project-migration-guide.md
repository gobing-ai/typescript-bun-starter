# Existing Project Migration Guide

> How to adopt this starter from an existing Bun/TypeScript codebase while using AI coding agents for the heavy lifting and keeping a human user as the final gatekeeper.

## 1. Goal

This starter is intended to become an increasingly capable baseline for Bun-first TypeScript projects. The long-term strategy is:

- Add reusable features, conventions, and guardrails to the starter.
- Let existing projects adopt those capabilities incrementally instead of rewriting everything.
- Use AI coding agents for the bulk of the migration work.
- Keep the end user responsible for high-impact approvals, architecture intent, and rollout safety.

This is not a "copy the starter over the top of an existing repo" playbook. It is a controlled adoption model.

## 2. Operating Principle

Treat the starter as a **reference implementation plus migration toolkit**.

That means:

- The starter should contain good defaults, clear boundaries, and reproducible verification.
- Existing projects should adopt patterns in slices, not by big-bang replacement.
- Agents should perform mechanical, repetitive, and consistency-heavy work.
- Humans should approve risky changes and judge whether a migration still serves product goals.

## 3. Best Fit

This guide is a good fit when the existing project already overlaps heavily with the starter:

- Bun runtime
- TypeScript strict mode
- Monorepo or multi-package structure
- Drizzle + SQLite or D1
- Hono for API work
- Astro web tier, or willingness to align with it later
- Desire for stronger contracts, docs, and repeatable AI-assisted workflows

If the current project is Node-first, framework-incompatible, or deeply coupled to a different architecture, adopt patterns selectively rather than forcing full alignment.

## 4. Recommended Migration Strategy

For most existing projects, the best default is **core-first extraction**.

### 4.1 Why core-first is the default

- It preserves working product surfaces.
- It moves shared business logic into a stable center first.
- It reduces duplication across CLI, server, and web tiers.
- It aligns directly with this starter's repo contract: `packages/contracts` owns transport-safe contracts, `packages/core` owns domain and data, and app tiers stay thin.

### 4.2 Migration strategies

#### A. Pattern adoption

Use when the existing project is mature and mostly healthy.

- Keep the repo.
- Adopt selected starter features: verification gate, workspace boundaries, adapter pattern, docs conventions, contracts, thin transport layers.
- Avoid large structural churn.

#### B. Core-first extraction

Use when the project works but architecture has drifted.

- Introduce or normalize `packages/core`.
- Introduce `packages/contracts` when transport-safe DTOs and API envelopes need a dedicated home.
- Move domain schemas, services, DB access, and logging into `packages/core`; move cross-tier transport contracts into `packages/contracts`.
- Keep API, CLI, and web layers functioning while they are gradually thinned.

#### C. Fresh starter plus port-in

Use when the existing repo is low quality, inconsistent, or early enough that retrofit cost is not worth it.

- Start from a fresh instance of the starter.
- Run `bun run bootstrap`.
- Optionally run `bun run clean-demo`.
- Port domain code and tests in controlled batches.

## 5. Human vs Agent Responsibilities

The cleanest migration model is: **agents execute, humans authorize**.

### 5.1 What the agent should do

- Inventory the current repo structure and dependencies.
- Map current modules to starter equivalents.
- Propose a phased migration plan.
- Create and update task files, checklists, and migration docs.
- Move files, update imports, and normalize workspace references.
- Introduce `packages/core` boundaries and thin transport layers.
- Add or update tests.
- Update docs and examples.
- Run verification commands and summarize failures precisely.

### 5.2 What the human should decide

- Whether the project should remain Bun-first or become multi-runtime.
- Whether auth, API shape, or deployment targets should change.
- Whether database migrations are safe to apply.
- Whether an existing tier should be removed, replaced, or deferred.
- Whether a breaking rename or public contract change is acceptable.
- Whether the rollout timing is safe.

### 5.3 Mandatory approval gates

The human should explicitly approve these categories before the agent proceeds:

- Database/storage changes
- Authentication or authorization changes
- Breaking API or CLI contract changes
- Deployment/runtime changes
- Workspace layout changes beyond the starter contract
- Destructive cleanup or irreversible refactors

## 6. Migration Workflow

### Phase 1. Discovery

The agent should first produce a factual inventory:

- Current workspaces or package boundaries
- Runtime and framework versions
- Database drivers and migration tooling
- Existing shared business logic locations
- Testing and coverage setup
- CI and release workflow touchpoints
- Known pain points, drift, or duplication

Recommended outputs:

- Current-to-target architecture map
- Dependency mismatch list
- Risk register
- Candidate adoption backlog

Recommended command set:

```bash
# Install dependencies and confirm the repo is runnable
bun install
bun run check

# Snapshot current structure
tree . -a -I 'node_modules|.git|coverage|dist'

# Inventory workspaces, scripts, and runtime choices
cat package.json
rg '"workspaces"|"scripts"|"bun:sqlite"|"better-sqlite3"|"drizzle"|"hono"|"astro"' -n .

# Inventory architecture hotspots
rg "new Database\\(|createDbAdapter|getDb\\(|require\\(|await import\\(" packages apps scripts -n
rg "clipanion|Command\\.paths|createRoute|OpenAPIHono|fetch\\(" apps packages -n

# Inventory tests and verification
rg --files . | rg '(^|/)(tests?/|.*\\.test\\.(ts|tsx))$'
rg '"check"|"test"|"typecheck"|"format"|"lint-fix"' package.json -n
```

### Phase 2. Target Mapping

Map the existing project into the starter model:

- `packages/contracts` for transport-safe shared types, DTOs, and API envelopes
- `packages/core` for domain, schemas, DB, and logger
- `apps/cli` for command transport
- `apps/server` for HTTP transport
- `apps/web` for UI transport

For each current module, classify it as:

- Keep as-is
- Move to `packages/core`
- Wrap temporarily
- Replace with starter pattern
- Defer

Recommended command set:

```bash
# Compare current project structure to starter expectations
tree packages apps -a -I 'node_modules|coverage|dist'

# Find shared business logic that should move into packages/core
rg "service|repository|schema|validator|zod|drizzle" src packages apps -n

# Find app-to-app coupling that should be removed
rg 'from "@starter/[^"]+"' apps -n
rg 'from "\\.\\./.*apps/' apps packages -n

# Find direct DB usage that should be funneled through adapters/core
rg "bun:sqlite|better-sqlite3|drizzle-orm/.+sqlite|sqliteTable" . -n
```

### Phase 3. Backlog Creation

Break migration into small, reviewable workstreams.

Good workstreams:

- Tooling alignment
- Workspace normalization
- Core extraction
- DB adapter alignment
- CLI transport cleanup
- API transport cleanup
- Web client alignment
- Docs and contract sync

Bad workstreams:

- "Migrate everything"
- "Replace architecture"
- "Cleanup old code"

Recommended command set:

```bash
# Create a branch before execution starts
git checkout -b chore/migrate-to-starter

# Capture a stable baseline for later review
git status --short
git diff --stat
```

### Phase 4. Execution

The agent should execute one workstream at a time and stop at approval boundaries.

For each workstream:

1. State the intended outcome.
2. List files to change.
3. Identify risks and approval requirements.
4. Make the smallest coherent patch.
5. Run verification.
6. Summarize exactly what changed and what remains.

Recommended command set:

```bash
# Reformat after each coherent patch
bun run format

# Run fast validation while iterating
bun run typecheck
bun run test

# Run the full gate before asking for approval or closing a workstream
bun run check

# Summarize patch scope for human review
git status --short
git diff --stat
git diff -- docs/ package.json packages apps
```

### Phase 5. Verification and Rollout

Each completed workstream should prove:

- `bun run check` passes
- Docs match implementation
- Starter contracts still hold
- Migration notes are updated
- Rollback path is obvious if rollout is staged

Recommended command set:

```bash
# Full repo gate
bun run check

# If the migration changed starter instructions or contracts
bun run check:contracts
bun run check:instructions

# Review change surface before approval
git diff --stat
git diff --name-only
```

## 7. Adoption Order

This is the recommended order for most existing projects.

### 7.1 First adopt

- Bun scripts and root verification gate
- Biome and strict TypeScript alignment
- Workspace dependency hygiene
- `packages/core` boundaries
- DB adapter pattern
- Test layout normalization

Suggested first-pass commands:

```bash
# Align repo hygiene first
bun install
bun run format
bun run typecheck
bun run test

# Verify workspace and dependency layout
cat package.json
rg '"workspace:\\*"' package.json packages apps -n
```

### 7.2 Then adopt

- CLI dual-mode output conventions
- API route patterns and error mapping
- Shared schema conventions
- Web typed client conventions
- Bootstrap and starter identity mechanics where relevant

Suggested second-pass commands:

```bash
# Audit domain and transport layering
rg "new .*Service\\(" apps -n
rg "z\\.object|openapi\\(" packages/core/src apps -n
rg "createRoute|OpenAPIHono|Command" apps -n
```

### 7.3 Adopt later or only if valuable

- Full tier additions the product does not currently need
- Instruction generation and agent-specific workflow files
- Optional deployment targets
- Broader runtime portability changes

## 8. Starter Features Existing Projects Should Leverage

As this starter evolves, existing projects should be able to consume improvements in a predictable way.

Good candidates for repeated downstream adoption:

- Verification gates and contract checks
- Shared config and package version policy
- Logging conventions
- Adapter seams for DB and runtime-specific dependencies
- Schema and validation patterns
- Thin CLI and API transport patterns
- Test utilities and in-memory DB helpers
- Bootstrap identity rewriting
- Demo cleanup and skeleton generation helpers

When a new starter feature is added, the maintainer should ask:

1. Is this feature reusable across existing projects?
2. Can an agent adopt it mostly mechanically?
3. What decisions still require human approval?
4. What is the migration surface area?
5. What docs and checks make adoption safe?

If those answers are unclear, the feature is not ready as a starter capability.

## 9. How to Design New Starter Features for Downstream Adoption

To make future migration easier, new starter features should follow these rules.

### 9.1 Favor additive seams

Prefer:

- New utilities
- New adapter entry points
- New scripts
- New contracts
- New optional workspaces

Avoid:

- Hidden global behavior
- Hard-coded runtime assumptions
- Cross-app imports
- Features that only work in the demo domain

### 9.2 Keep migration surfaces explicit

A new feature should clearly state:

- Files it touches
- Required config changes
- Verification command
- Whether it is safe for incremental adoption
- Whether it is breaking

### 9.3 Ship migration notes with the feature

If a feature materially improves the starter, document:

- Why it exists
- Which existing projects should adopt it
- Adoption steps
- Approval boundaries
- Expected verification

## 10. Human Gatekeeper Checklist

Before approving a migration workstream, the human should confirm:

- The change solves a real project problem, not just "matches the starter"
- Business logic remains correct
- Public contracts are preserved or deliberately changed
- Data and migration risks are understood
- Rollback is possible
- Verification evidence is sufficient

If the answer is unclear, do not approve the next step yet.

Human review commands:

```bash
# Review only what changed in this workstream
git status --short
git diff --stat
git diff

# If desired, inspect the previous stable point
git log --oneline --decorate -n 10
```

## 11. Practical Agent Prompting Model

The most effective instructions to an AI agent are concrete and bounded.

Good prompt shape:

```text
Analyze this repo against the TypeScript Bun Starter.
Produce:
1. current-to-target mapping,
2. migration backlog grouped by workstream,
3. approval gates that require human review,
4. recommended first patch.
Do not change files yet.
```

Execution prompt shape:

```text
Implement only the "workspace normalization" workstream.
Stop before any database, auth, or deployment changes.
Update docs for any changed behavior.
Run bun run check and summarize the result.
```

Gate prompt shape:

```text
Before proceeding, show me:
1. breaking changes,
2. files changed,
3. risks,
4. rollback approach,
5. exact recommendation.
Wait for approval before editing migrations or runtime boundaries.
```

Agent execution command template:

```bash
# 1. Start from a clean branch
git checkout -b chore/<workstream-name>

# 2. Make the patch
# agent edits files here

# 3. Normalize formatting and validate
bun run format
bun run check

# 4. Prepare review evidence
git status --short
git diff --stat
git diff
```

## 12. Command Reference

These commands are useful enough to standardize across migrations.

### 12.1 Baseline startup

```bash
bun install
bun run check
```

### 12.2 Starter identity sync for fresh adoptions

Use this only when the migration path starts from a fresh copy of the starter.

```bash
bun run bootstrap -- --name my-project --scope @acme --title "My Project"

# Optional: remove the demo domain before porting in real code
bun run clean-demo
```

### 12.3 Database alignment

Use these only after human approval for schema or data-impacting changes.

```bash
# Push schema directly in dev
bun run db:push

# Generate versioned migrations
bun run db:generate

# Apply migrations
bun run db:migrate
```

### 12.4 Focused code search

```bash
# Find starter-boundary issues
rg 'from "apps/|from "\\.\\./.*apps/' packages apps -n

# Find direct runtime-specific DB coupling
rg "bun:sqlite|better-sqlite3|drizzle-orm/.+sqlite" . -n

# Find transport logic that should move into core
rg "fetch\\(|Request|Response|Context|Command|Option\\." packages/core apps -n
```

### 12.5 Final proof before approval

```bash
bun run check
git status --short
git diff --stat
git diff --name-only
```

## 13. Anti-Patterns

Avoid these migration failure modes:

- Big-bang rewrites justified only by "consistency"
- Moving code before understanding ownership boundaries
- Treating the starter as dogma instead of a reusable baseline
- Letting the agent change auth, data, or deployment without approval
- Copying demo code into production domains without refactoring intent
- Updating docs after the fact instead of in the same patch

## 14. Success Criteria

A successful migration is not "the repo now looks exactly like the starter."

A successful migration means:

- Shared domain logic is cleaner and easier to reuse
- Transport layers are thinner
- Verification is stronger
- Future starter improvements can be adopted incrementally
- Agents can perform most future maintenance safely
- Humans only need to intervene at high-value decision points

That is the real objective: make this starter a force multiplier for both new projects and existing ones.
