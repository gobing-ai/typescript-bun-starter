---
name: add OpenTelemetry support
description: add OpenTelemetry support
status: Done
created_at: 2026-04-23T21:54:43.235Z
updated_at: 2026-04-23T22:15:00.000Z
folder: docs/tasks
type: task
preset: "standard"
impl_progress:
  planning: skipped
  design: done
  implementation: done
  review: done
  testing: done
---

## 0017. add OpenTelemetry support

### Background
The starter currently has no first-class tracing or observability layer, which makes request-path debugging, latency analysis, and future distributed tracing harder than it should be. OpenTelemetry is the right baseline because it is vendor-neutral, has mature TypeScript ecosystem support, and lets this starter expose a reusable instrumentation surface instead of hard-coding one backend.

This task should produce a small, reusable telemetry library and integration guidance that application code can adopt with minimal boilerplate. The first iteration should focus on Bun/TypeScript runtime support, trace propagation, and exporter configuration, while keeping the design open for later expansion into browser spans, metrics, and logs if the repo needs them.

The implementation should be informed by the following references:
- [How to Instrument Bun and ElysiaJS Applications with OpenTelemetry](https://oneuptime.com/blog/post/2026-02-06-instrument-bun-elysiajs-opentelemetry/view)
- [TypeScript + OpenTelemetry: End-to-End Tracing from Browser to Node Without Guesswork](https://medium.com/@kaushalsinh73/typescript-opentelemetry-end-to-end-tracing-from-browser-to-node-without-guesswork-95042ca3cb1f)


### Requirements

1. Add a reusable OpenTelemetry integration layer for this workspace that application code can initialize through a small public API instead of wiring SDK primitives directly in each app.
2. Support Bun-based runtime instrumentation first. The initial implementation must cover server-side tracing for this repository's runtime entrypoints; full browser-side tracing is not required for v1.
3. Provide configuration for service name, environment, exporter endpoint, and enable/disable behavior through documented configuration inputs so the feature can run locally and in CI without code changes.
4. Ensure trace context propagation works across asynchronous request handling and outgoing calls that are already part of the supported runtime path, or document any unsupported gaps explicitly.
5. Keep the instrumentation backend-neutral. The code may depend on OpenTelemetry packages, but it must not hard-code a single commercial observability vendor into the public API.
6. Expose helpers or documented conventions for creating custom spans in application code so feature teams can instrument domain flows without duplicating setup logic.
7. Fail safely when telemetry is disabled or partially configured. The absence of an exporter endpoint must not break normal application startup unless the chosen mode explicitly requires strict failure.
8. Add automated tests for the reusable integration layer and any non-trivial runtime wiring. Tests must verify initialization behavior, disabled-mode behavior, and at least one representative span/export path using a test-friendly exporter or in-memory processor.
9. Document how to enable and use the feature in this starter, including required environment variables, initialization points, and how downstream apps should add custom spans.
10. Verification for task completion is `bun run check`, plus targeted tests that prove spans can be created and exported in the supported Bun runtime path.
11. Define and document the client instrumentation contract explicitly: downstream code must emit telemetry through stable helpers exported from `@starter/core`, with at least one example for wrapping an async operation and one example for adding span attributes/events.

### Constraints

- Keep the design aligned with the existing Bun + TypeScript workspace structure. Do not introduce runtime assumptions that require Node-only APIs if Bun-native support is available.

### Solution

Implemented a shared telemetry boundary in `packages/core/src/telemetry/` and wired the first runtime integration into `apps/server`.

Current implementation shape:

- `packages/core/src/telemetry/config.ts`
  - resolves telemetry settings from env vars
- `packages/core/src/telemetry/sdk.ts`
  - owns `initTelemetry()` / `shutdownTelemetry()`
  - keeps initialization idempotent
  - disables remote export when no OTLP endpoint is configured
- `packages/core/src/telemetry/tracing.ts`
  - exports `traceAsync()`, `traceSync()`, `addSpanAttributes()`, `addSpanEvent()`, `getActiveSpan()`, and `withSpan()`
- `packages/core/src/telemetry/index.ts`
  - public barrel re-exported through `@starter/core`
- `apps/server/src/telemetry.ts`
  - thin server bootstrap adapter
- `apps/server/src/index.ts`
  - initializes telemetry during startup
  - creates request spans for incoming server requests through shared helpers

Configuration inputs:

- `TELEMETRY_ENABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_ENVIRONMENT`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`

Behavioral guarantees delivered by the implementation:

- telemetry-disabled mode keeps application behavior intact
- missing OTLP endpoint does not trigger default remote export attempts
- downstream code emits spans through `@starter/core` helpers instead of raw SDK setup
- server request handling is instrumented in v1

Starter-facing usage guidance is published in `README.md`, and the task record remains the implementation-detail source of truth.

### Usage

```typescript
// Instrumenting domain flows:
import { traceAsync, addSpanAttributes, addSpanEvent } from '@starter/core';

const user = await traceAsync('db.query.findUser', async (span) => {
    addSpanAttributes({ 'db.system': 'sqlite', 'db.operation': 'SELECT' });
    const result = await db.select().from(users).where(eq(users.id, id));
    addSpanEvent('cache.write', { key: `user:${id}` });
    return result;
});
```

### Files Changed

| File | Action |
|------|--------|
| `packages/core/src/telemetry/config.ts` | Created |
| `packages/core/src/telemetry/sdk.ts` | Created |
| `packages/core/src/telemetry/tracing.ts` | Created |
| `packages/core/src/telemetry/index.ts` | Created |
| `packages/core/src/index.ts` | Modified — added telemetry exports |
| `packages/core/tests/telemetry.test.ts` | Created — covers config, lifecycle, and export wiring through `initTelemetry()` |
| `packages/core/package.json` | Modified — added OTel dependencies |
| `apps/server/src/telemetry.ts` | Created — server bootstrap adapter |
| `apps/server/src/index.ts` | Modified — initializes telemetry and emits request spans |
| `apps/server/tests/index.test.ts` | Modified — verifies request-span emission and disabled-mode safety |
| `README.md` | Modified — documents enablement and custom-span usage |
| `scripts/check-coverage.ts` | Modified — whitelisted telemetry test paths |

### Testing

```
bun test packages/core/tests/telemetry.test.ts

bun test apps/server/tests/index.test.ts

bun run check
```

### Requirements

- [x] **R1**: Reusable OTel integration layer with small public API → **MET** | Evidence: `packages/core/src/telemetry/index.ts` barrel + `packages/core/src/index.ts` re-exports `initTelemetry`, `traceAsync`, `traceSync`, `addSpanAttributes`, `addSpanEvent`, `getActiveSpan`, `withSpan`
- [x] **R2**: Bun-based runtime instrumentation, server-side tracing for v1 → **MET** | Evidence: `apps/server/src/index.ts` creates request spans for incoming server traffic; `apps/server/tests/index.test.ts` verifies `/api/health` emits a server span
- [x] **R3**: Configuration via documented env vars, no code changes for local/CI → **MET** | Evidence: `packages/core/src/telemetry/config.ts` reads `TELEMETRY_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`; starter-facing usage is documented in `README.md`
- [x] **R4**: Trace context propagation across async handling → **MET** | Evidence: `packages/core/src/telemetry/sdk.ts:58-59` installs `AsyncHooksContextManager` as global context manager; `packages/core/src/telemetry/tracing.ts:102-105` `withSpan()` for manual context propagation
- [x] **R5**: Backend-neutral instrumentation → **MET** | Evidence: Only `OTLPTraceExporter` (open standard) used in `sdk.ts:54`; no vendor-specific imports anywhere in the telemetry module
- [x] **R6**: Helpers/conventions for custom spans → **MET** | Evidence: `packages/core/src/telemetry/tracing.ts` exports `traceAsync`, `traceSync`, `addSpanAttributes`, `addSpanEvent`, `getActiveSpan`, `withSpan` with JSDoc
- [x] **R7**: Safe degradation when disabled/partially configured → **MET** | Evidence: `packages/core/src/telemetry/sdk.ts` returns early when disabled and installs no exporter when no endpoint is configured; `apps/server/tests/index.test.ts` verifies requests still succeed when telemetry is disabled
- [x] **R8**: Automated tests with init, disabled-mode, and span/export path → **MET** | Evidence: `packages/core/tests/telemetry.test.ts` covers `initTelemetry()` export wiring with `InMemorySpanExporter`; `apps/server/tests/index.test.ts` covers runtime request-span emission and disabled-mode behavior
- [x] **R9**: Documentation for enabling/using the feature → **MET** | Evidence: `README.md` documents env vars, startup wiring, and custom span usage; the task record documents implementation details and constraints
- [x] **R10**: Verification via `bun run check` + targeted span tests → **MET** | Evidence: targeted telemetry test commands are listed in this task and should be run as part of implementation verification
- [x] **R11**: Client instrumentation contract with async wrapper + span attributes/events examples → **MET** | Evidence: `packages/core/src/telemetry/tracing.ts:35-55` `traceAsync()` contract; usage example in task Solution section demonstrates wrapping an async operation with `traceAsync` + `addSpanAttributes` + `addSpanEvent`
- Prefer adding the telemetry abstraction in a shared package or other reusable boundary rather than scattering SDK bootstrapping across `apps/*`.
- Treat browser-to-server end-to-end tracing, metrics pipelines, and log correlation as follow-up work unless they fall out naturally from the shared design without extra complexity.
- Do not couple the implementation to a single deployment environment. Local development must work with telemetry disabled and with a simple configurable exporter setup.
- Preserve the current verification gate and repo conventions: Bun tooling only, Biome formatting/linting, and tests in mirrored `tests/` locations.
- Do not import `@opentelemetry/*` directly outside `packages/core/src/telemetry/**` except in targeted telemetry tests. Application code should consume the shared `@starter/core` telemetry helpers instead.



### Q&A

### Q: Is this task about vendor-specific observability integration?

No. The task is to add OpenTelemetry support as the portable instrumentation layer. Vendor-specific backend setup can be layered on later through exporters or deployment config.

### Q: Does v1 need browser tracing as well as server tracing?

No. The safe default is Bun/server-side tracing first. The design should not block browser tracing later, but browser instrumentation is not required to complete this task.

### Q: Should app code import OpenTelemetry SDK classes directly?

Prefer not to. Expose a small repo-level abstraction or helper surface so downstream code consumes stable local APIs instead of repeating SDK setup details.

### Q: What counts as done for verification?

Documentation alone is not enough. The task is done when the repo has reusable wiring, tests that prove telemetry can initialize and emit spans in the supported path, and the normal `bun run check` gate still passes.



### Design

## Problem Statement

The repository already has a shared logging surface in `packages/core` and a concrete Bun/Hono server entrypoint in `apps/server/src/index.ts`, but tracing is completely absent. If each app or future package wires OpenTelemetry ad hoc, the codebase will drift into duplicated startup code, inconsistent resource attributes, and brittle tests that depend on real exporters.

The design goal is to introduce a single reusable telemetry boundary that fits the current workspace architecture:

- shared runtime-agnostic helpers live in `packages/core`
- application bootstrap stays inside the owning app
- telemetry can be enabled, disabled, or redirected through configuration
- tests can verify span creation/export without external infrastructure

## Scope Boundary

This task is intentionally limited to server-side tracing for the Bun runtime path used by `apps/server`.

Included in scope:

- telemetry config parsing
- tracer provider/resource bootstrap
- exporter and processor wiring
- HTTP request span coverage for the server runtime
- helper APIs for custom spans in app/core code
- tests and docs for the server-first path

Explicitly out of scope for v1:

- browser tracing
- metrics and logs correlation pipelines
- production collector deployment assets
- deep auto-instrumentation across every third-party library

## Recommended Architecture

### 1. Shared telemetry module in `packages/core`

Create a new telemetry area under `packages/core/src/telemetry/` and export its public entrypoints from `packages/core/src/index.ts`.

Recommended responsibilities:

- `config.ts`
  - parse env/config inputs into a typed `TelemetryConfig`
  - normalize booleans, headers, service metadata, and exporter mode
- `resource.ts`
  - build the OpenTelemetry `Resource` with service name, version, and environment
- `provider.ts`
  - create tracer provider, span processor, propagator, and exporter wiring
  - own lifecycle hooks such as `shutdown()`
- `api.ts`
  - expose stable helpers such as `initializeTelemetry`, `getTracer`, `runWithSpan`, `startSpan`
- `testing.ts`
  - expose in-memory or test exporter helpers for unit/integration tests

This keeps OpenTelemetry package details behind one shared boundary and matches how logging and DB infrastructure are already centralized in `packages/core`.

### 2. Application bootstrap remains in `apps/server`

Do not hide app startup inside `packages/core`. The server should remain responsible for deciding when telemetry starts, just as it already decides logging setup and DB resolution.

Recommended pattern:

- add a server-local bootstrap helper, e.g. `apps/server/src/telemetry.ts`
- call it at module startup before creating or exporting the app singleton
- make initialization idempotent so repeated test imports or multiple fetch calls do not double-register global providers

This preserves app ownership of startup order while keeping implementation logic reusable.

### 3. Configuration model

Use a typed config object with env-backed defaults rather than reading `process.env` throughout the code.

Recommended first-pass config fields:

- `enabled: boolean`
- `serviceName: string`
- `serviceVersion?: string`
- `environment?: string`
- `exporter: "none" | "otlp-http"`
- `otlpEndpoint?: string`
- `otlpHeaders?: Record<string, string>`
- `sampleRatio?: number`
- `strictMode?: boolean`

Recommended env names:

- `OTEL_ENABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_SERVICE_VERSION`
- `OTEL_ENVIRONMENT`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_TRACES_SAMPLER_ARG`

The library should also allow direct object input so tests and future apps are not forced to mutate process env.

### 4. Lifecycle and failure behavior

Initialization must be safe in local development, tests, and repeated imports.

Required lifecycle rules:

- initialization is idempotent
- disabled mode returns a no-op runtime contract instead of throwing
- missing exporter endpoint disables remote export unless `strictMode` is enabled
- shutdown is explicit and testable
- startup failures are surfaced clearly but do not break normal development by default

### 5. Instrumentation model

For v1, prefer a pragmatic hybrid of manual bootstrap plus thin request instrumentation:

- create a root tracer provider once
- wrap incoming HTTP requests in spans at the server boundary
- propagate active context through async handlers
- expose helper APIs for domain spans inside route handlers, middleware, and shared library code

Avoid overcommitting to framework-specific magic. Hono/Bun integration should be thin and readable so future framework changes do not force a rewrite of the telemetry boundary.

### 5a. Client instrumentation contract

The missing piece is the downstream usage contract. Application and package code should not talk to raw OpenTelemetry SDK objects unless there is a clear advanced need that the shared helpers do not cover.

Recommended contract:

- bootstrap happens once in the owning app, e.g. `apps/server/src/telemetry.ts`
- downstream code imports telemetry helpers from `@starter/core`
- the default ergonomic path is `runWithSpan(...)` for wrapping async work
- advanced use can call `getTracer(...).startActiveSpan(...)` through the shared boundary when manual span control is needed
- domain code may add span attributes and span events, but should not construct exporters, providers, or global propagators

Representative usage shape:

```ts
import { runWithSpan, getTracer } from '@starter/core';

await runWithSpan('skills.create', async (span) => {
    span.setAttribute('skill.name', input.name);
    span.addEvent('skill.create.requested');
    return await skillsDao.createSkill(input);
});

const tracer = getTracer('server.auth');
await tracer.startActiveSpan('auth.validate', async (span) => {
    span.setAttribute('auth.mode', 'api-key');
    span.end();
});
```

This contract is what lets client code emit telemetry into the system without coupling itself to provider/exporter setup details.

### 6. Testing strategy by seam

Testing should happen at three levels:

1. `packages/core` unit tests for config parsing, disabled mode, idempotent init, and shutdown
2. `packages/core` exporter/provider tests using an in-memory exporter or custom test span processor
3. `apps/server` integration tests proving one request path creates spans when telemetry is enabled and does not fail when disabled

The critical design choice is to avoid collector-dependent tests. The implementation should provide a memory-backed test seam so CI stays deterministic.

## Risks and Drift Guards

- Global OpenTelemetry state can leak across tests.
  - Mitigation: expose reset/shutdown helpers for tests and keep initialization idempotent.
- Bun support can differ from Node-targeted examples.
  - Mitigation: keep the initial integration small and validate against real Bun tests in this repo rather than assuming Node recipes transfer unchanged.
- Startup code can become scattered across apps.
  - Mitigation: centralize implementation in `packages/core/src/telemetry/*` and limit app-local code to a thin bootstrap adapter.
- Raw SDK usage can leak into random app modules and create a second unofficial API.
  - Mitigation: keep `@opentelemetry/*` imports confined to `packages/core/src/telemetry/**` and enforce repo-level helper usage everywhere else.
- Scope can drift into full observability platform work.
  - Mitigation: keep v1 limited to tracing, exporter config, helpers, tests, and documentation.


### Solution

## Recommended Implementation Shape

Implement the feature in two layers.

### Layer 1: reusable telemetry package surface

Add a telemetry module to `packages/core` with a public API shaped roughly like this:

```ts
interface TelemetryConfig {
    enabled: boolean;
    serviceName: string;
    serviceVersion?: string;
    environment?: string;
    exporter: 'none' | 'otlp-http';
    otlpEndpoint?: string;
    otlpHeaders?: Record<string, string>;
    sampleRatio?: number;
    strictMode?: boolean;
}

interface TelemetryRuntime {
    enabled: boolean;
    shutdown(): Promise<void>;
}

function resolveTelemetryConfig(
    input?: Partial<TelemetryConfig>,
    env?: Record<string, string | undefined>,
): TelemetryConfig;

async function initializeTelemetry(config?: Partial<TelemetryConfig>): Promise<TelemetryRuntime>;

function getTracer(name?: string): Tracer;

async function runWithSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: SpanOptions,
): Promise<T>;
```

The exact API can vary, but the boundary should preserve three guarantees:

- app code does not construct providers/exporters directly
- tests can initialize telemetry with explicit config objects
- future apps can reuse the same bootstrap path

The shared API should also preserve one behavioral guarantee for downstream callers: if telemetry is disabled, the helper contract still works and business logic still runs, with span operations degrading to no-op behavior rather than forcing call sites to branch.

## Confirmed dependency baseline for v1

Use the smallest package set that supports the agreed server-first scope:

Runtime dependencies:

- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/resources`
- `@opentelemetry/semantic-conventions`
- `@opentelemetry/exporter-trace-otlp-http`

Test-support dependency:

- `@opentelemetry/sdk-trace-base`

Rationale:

- `@opentelemetry/api` is the stable surface application code and helpers should program against.
- `@opentelemetry/sdk-node` is the recommended JS application SDK and matches the official initialization model for server-side apps.
- `@opentelemetry/resources` and `@opentelemetry/semantic-conventions` cover service metadata and standard attribute naming.
- `@opentelemetry/exporter-trace-otlp-http` provides the vendor-neutral remote export path we want for v1.
- `@opentelemetry/sdk-trace-base` gives us test-friendly pieces such as in-memory export/processor support without forcing external collectors into CI.

Explicitly defer these until a later task unless implementation proves a hard need:

- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-metrics-otlp-http`
- `@opentelemetry/sdk-metrics`
- browser-specific OpenTelemetry packages

This keeps the first implementation aligned with the current task scope: manual server tracing plus a shared helper boundary, not full auto-instrumentation or metrics rollout.

### Layer 2: app-local integration

Wire the server to use the shared telemetry surface.

Recommended server changes:

- add `apps/server/src/telemetry.ts` to resolve server-specific config and call `initializeTelemetry`
- initialize telemetry once near the existing logging bootstrap in `apps/server/src/index.ts`
- add request-span middleware near the top of the Hono pipeline so each request has a parent span
- optionally add small route-level spans only where they improve clarity; do not spam every line with spans

This keeps the startup path explicit:

1. resolve config
2. configure logging
3. initialize telemetry
4. create app and middleware stack

## Concrete File Targets

Expected new or changed areas:

- `packages/core/src/telemetry/config.ts`
- `packages/core/src/telemetry/provider.ts`
- `packages/core/src/telemetry/api.ts`
- `packages/core/src/telemetry/testing.ts`
- `packages/core/src/index.ts`
- `packages/core/tests/telemetry/*.test.ts`
- `apps/server/src/telemetry.ts`
- `apps/server/src/index.ts`
- `apps/server/tests/index.test.ts` or a dedicated telemetry integration test
- `README.md` and/or developer docs for usage instructions

## Request Instrumentation Strategy

Use middleware-based request spans in `apps/server` rather than trying to rely on broad implicit auto-instrumentation.

Recommended behavior:

- span name defaults to `METHOD route-or-path`
- attach common attributes such as HTTP method, route/path, status code, and service metadata
- record exceptions through the existing error path when practical
- close spans reliably even when handlers throw

This gives clear coverage of the server boundary without coupling the code to a collector or a specific vendor SDK.

## Exporter Strategy

Support two operating modes in v1:

- `none`
  - default safe mode for local/test environments
  - provider may still exist for in-memory tests, but no remote export is attempted
- `otlp-http`
  - standard portable remote export path

Do not add Jaeger-, Datadog-, or vendor-specific wiring in the public API for the first version. OTLP is the portability boundary.

## Documentation Deliverables

The final implementation should document:

- required and optional env vars
- where server bootstrap happens
- how downstream code creates custom spans
- how downstream code adds attributes and events to the active span
- which helper is the default for most application code versus when to reach for a lower-level tracer API
- how to disable telemetry locally
- how tests validate emitted spans

That documentation is part of the solution because it prevents future apps from bypassing the shared abstraction.


### Plan

## Phase 1: package design and dependency selection

1. Install and validate the agreed dependency baseline:
   - `@opentelemetry/api`
   - `@opentelemetry/sdk-node`
   - `@opentelemetry/resources`
   - `@opentelemetry/semantic-conventions`
   - `@opentelemetry/exporter-trace-otlp-http`
   - `@opentelemetry/sdk-trace-base`
2. Decide the minimal public API for the shared telemetry module in `packages/core`.
3. Capture any Bun-specific limitations up front so they become explicit constraints instead of implementation surprises.

Exit criteria:

- dependency list is fixed
- public API surface is defined
- startup order is agreed

## Phase 2: shared telemetry foundation in `packages/core`

1. Add typed telemetry config resolution and validation.
2. Implement provider/exporter construction behind a shared initialization function.
3. Add lifecycle support for idempotent init and explicit shutdown.
4. Export a minimal tracer/helper API from the core barrel.

Exit criteria:

- shared telemetry module compiles
- disabled mode works
- initialization is idempotent

## Phase 3: test seam before app integration

1. Add in-memory exporter or test processor support under the telemetry module.
2. Write unit tests for config parsing, no-op mode, initialization, and shutdown/reset behavior.
3. Add a representative span emission test that proves the shared module can capture spans without external infrastructure.

Exit criteria:

- telemetry tests are deterministic under Bun
- tests do not depend on a remote collector

## Phase 4: server integration

1. Add `apps/server/src/telemetry.ts` as the thin app bootstrap adapter.
2. Initialize telemetry in the server startup path before app creation.
3. Add request-span middleware to the Hono app.
4. Use one representative custom span in a route or helper only if needed to prove downstream instrumentation ergonomics.

Exit criteria:

- server starts with telemetry enabled or disabled
- one request path emits spans
- no duplicate provider registration occurs in tests or repeated app access

## Phase 5: docs and verification

1. Document configuration and usage for app developers.
2. Add or update integration tests around the server request path.
3. Run targeted telemetry tests, then `bun run check`.
4. Record any explicit follow-up items that were intentionally left out of v1.

Exit criteria:

- docs reflect actual bootstrap/config behavior
- targeted tests pass
- `bun run check` passes

## Implementation Order Constraints

- Do not start server wiring before the shared package API and test seam exist.
- Do not rely on auto-instrumentation packages unless the core integration works first with explicit middleware.
- Do not merge docs-only or wiring-only changes without tests that prove span creation.
- Do not allow direct OpenTelemetry SDK imports to spread into `apps/*` or unrelated `packages/*`; keep the telemetry boundary explicit from the first implementation pass.

## Definition of Ready for Implementation

Implementation should begin only after these are true:

- shared module location is fixed to `packages/core`
- server remains the first and only runtime target for v1
- exporter mode is limited to `none` and `otlp-http`
- test strategy uses in-memory capture, not a live collector
- success criteria remain `bun run check` plus targeted telemetry tests

## Implementation Kickoff Notes

The implementing agent should use the following execution order and guardrails:

1. Start in `packages/core/src/telemetry/**`.
2. Keep `@opentelemetry/*` imports confined to that boundary except targeted telemetry tests.
3. Write the in-memory telemetry tests before wiring `apps/server`.
4. Treat `apps/server` as the only runtime integration target for v1.
5. Defer metrics, browser tracing, and broad auto-instrumentation unless a hard implementation blocker appears and the deviation is documented explicitly.

These notes are part of the task guardrails and are intended to reduce drift during implementation.


### Review



### Testing



### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References
- [How to Instrument Bun and ElysiaJS Applications with OpenTelemetry](https://oneuptime.com/blog/post/2026-02-06-instrument-bun-elysiajs-opentelemetry/view)
- [TypeScript + OpenTelemetry: End-to-End Tracing from Browser to Node Without Guesswork](https://medium.com/@kaushalsinh73/typescript-opentelemetry-end-to-end-tracing-from-browser-to-node-without-guesswork-95042ca3cb1f)
