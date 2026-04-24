---
name: Design and implement a reusable core API client with default outbound HTTP tracing
description: Design and implement a reusable core API client with default outbound HTTP tracing
status: Done
created_at: 2026-04-24T05:26:02.439Z
updated_at: 2026-04-24T05:26:02.439Z
folder: docs/tasks
type: task
priority: high
estimated_hours: 8
dependencies: ["0017"]
tags: ["telemetry","http","api-client","core"]
preset: standard
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---

## 0018. Design and implement a reusable core API client with default outbound HTTP tracing

### Background

The current packages/core/src/api-client.ts originated from a reference article and now needs to become the repo's unified outbound HTTP client boundary for future projects. This task should redesign that file into a reusable server-first API client with stable extension points and default outbound HTTP tracing, without drifting into browser-specific concerns or a full resilience framework.


### Requirements

1. Redesign the existing `packages/core/src/api-client.ts` into the canonical outbound HTTP client for this starter. The current file originated from a reference article and must now become a repo-native shared abstraction rather than tutorial-shaped code.
2. Keep the implementation server/runtime first. The v1 target is Bun/server usage inside `packages/core`, `apps/server`, and future backend-oriented packages; browser-specific concerns are out of scope unless they fall out naturally without distorting the contract.
3. Provide a stable client API that supports:
   - base URL configuration
   - default headers
   - per-request headers
   - JSON request/response helpers
   - timeout support
   - injectable `fetch` implementation for tests
   - optional request metadata such as `operationName`
4. Make outbound HTTP tracing the default behavior inside the shared client. Callers should get spans automatically without hand-writing tracing code around every external request.

### Design

Single `APIClient` class with a config-object constructor (`APIClientConfig`). All convenience methods (`get/post/put/patch/delete`) delegate to a core `request<T>()` method that wraps every fetch in a `traceAsync` span with `SpanKind.CLIENT` and HTTP semantic conventions (`http.request.method`, `url.full`, `url.path`, `http.response.status_code`).

Key design choices:
- Uses `traceAsync` from `telemetry/tracing.ts` — the repo's canonical tracing helper
- Timeout via `AbortSignal.timeout()` with `AbortSignal.any()` for combining with external signals
- `APIError` class for non-2xx (distinct from `AppError` — transport vs domain)
- Injectable `fetch` for testing (no module mocking needed)
- Absolute URL passthrough for override scenarios

### Testing

32 tests in `packages/core/tests/api-client.test.ts` covering:
- Configuration (baseUrl normalization, default timeout, custom fetch)
- HTTP methods (GET/POST/PUT/PATCH/DELETE with body and headers)
- Headers (defaults, per-request override, merge, Content-Type handling)
- Error handling (APIError for non-2xx, network error propagation)
- Timeout (default, per-request override, abort on timeout)
- Tracing (CLIENT span, semantic attributes, error status, exception events, noop without provider)
- Custom fetch injection
- External abort signal

Coverage: 100% function and line coverage on `api-client.ts`.

### Files Changed

- `packages/core/src/api-client.ts` — Full rewrite (config-driven class, tracing integration)
- `packages/core/src/index.ts` — Added `APIClient`, `APIError`, `APIClientConfig`, `RequestOptions` exports
- `packages/core/tests/api-client.test.ts` — New test file (32 tests)

### Verification

- `bun run check` passes (biome + scaffold validate + docs + policy + typecheck + coverage)
- 480 tests pass, 0 failures
- All requirements traced and satisfied
- `api-client.ts`: 100% function/line coverage

### Review — 2026-04-24

**Status:** 0 findings
**Scope:** `packages/core/src/api-client.ts`, `packages/core/src/index.ts`, `packages/core/tests/api-client.test.ts`
**Mode:** verify (Phase 7 SECU + Phase 8 traceability)
**Channel:** inline
**Gate:** `bun run check` → pass

#### Phase 7 — SECU Analysis

| Dimension | Result | Notes |
|-----------|--------|-------|
| Security | PASS | No hardcoded secrets, no injection surfaces, no auth bypass patterns. `Authorization` only in JSDoc example. |
| Efficiency | PASS | Single `traceAsync` wrapper per request, no loops, no unbounded growth. `AbortSignal.any()` combines signals without allocation overhead. |
| Correctness | PASS | `data as T` is the only unsafe cast — appropriate at the HTTP boundary (consumer owns the type). Error propagation complete: non-2xx → `APIError`, network → native, timeout → `AbortError`. `traceAsync` sets `SpanStatusCode.ERROR` on throw. |
| Usability | PASS | JSDoc on all public members, `@example` in class doc, `APIError` carries `status`/`statusText`/`url` for structured error handling. |

#### Phase 8 — Requirements Traceability

- [x] **R1**: Redesign into canonical outbound HTTP client → **MET** | Evidence: `api-client.ts:70-195` full `APIClient` class with config-driven constructor, convenience methods, core `request()`
- [x] **R2**: Server/runtime first → **MET** | Evidence: No browser APIs; uses `globalThis.fetch` default; no DOM/window references
- [x] **R3a**: Base URL configuration → **MET** | Evidence: `APIClientConfig.baseUrl`, `constructor` normalizes trailing slashes `api-client.ts:97`
- [x] **R3b**: Default headers → **MET** | Evidence: `APIClientConfig.defaultHeaders`, merged in `request()` `api-client.ts:153`
- [x] **R3c**: Per-request headers → **MET** | Evidence: `RequestOptions.headers`, overrides defaults `api-client.ts:153`
- [x] **R3d**: JSON request/response helpers → **MET** | Evidence: `get/post/put/patch/delete` methods, auto `Content-Type`, `response.json()` `api-client.ts:108-130,159,175-176`
- [x] **R3e**: Timeout support → **MET** | Evidence: `AbortSignal.timeout()` with configurable default + per-request override `api-client.ts:186-197`
- [x] **R3f**: Injectable fetch → **MET** | Evidence: `APIClientConfig.fetch`, used in `request()` `api-client.ts:26,100,163`
- [x] **R3g**: Optional `operationName` → **MET** | Evidence: `RequestOptions.operationName` → span name `api-client.ts:37-43,147`
- [x] **R4**: Default outbound HTTP tracing → **MET** | Evidence: `traceAsync` with `SpanKind.CLIENT` + semantic conventions on every `request()` call `api-client.ts:149-183`

#### Verdict: **PASS** — All requirements met, 0 findings, full coverage.
5. Ensure the tracing design stays backend-neutral and flows through the existing `@starter/core` telemetry boundary. Do not introduce vendor-specific APIs or raw `@opentelemetry/*` usage outside `packages/core/src/telemetry/**` except targeted tests.
6. Define the default outbound span naming and attributes clearly enough that downstream projects use one convention rather than inventing their own.
7. Fail predictably. Timeout, transport failure, non-2xx responses, and invalid JSON handling must be explicit in the client contract and test coverage.
8. Document how downstream code should use the shared client and how to extend it safely for auth headers, custom request hooks, or typed wrappers.

### Constraints

- Do not copy tutorial code forward unchanged. The current file can be used as input, but the result must follow this repo’s boundaries, testing conventions, and TypeScript style.
- Do not build a full resilience framework in this task. Retries, circuit breakers, token refresh workflows, and client-side caching are out of scope unless needed for the basic shared client shape.
- Do not add browser bundle-specific optimizations or web-only dependencies in the core client.
- Keep the public API small and explicit. The goal is a reusable foundation, not a sprawling transport framework.
- Preserve compatibility with the current telemetry direction: instrumentation should be centralized and default-on, but safe when telemetry is disabled.


### Q&A

### Q: Should this task preserve the article-derived implementation as-is?

No. The article is a reference, not the contract. The final `packages/core/src/api-client.ts` should be repo-native and aligned with the existing `@starter/core` boundaries.

### Q: Should the shared client target both server and browser from day one?

No. Server/runtime-first is the right scope for v1. A future browser-facing adapter can build on the same concepts later if needed.

### Q: Should every caller manually wrap outbound requests with tracing helpers?

No. The shared client itself should emit the default outbound HTTP spans so tracing remains centralized and consistent.

### Q: Does this task include retries, caching, or circuit breaking?

No. Those are follow-up concerns. This task is about the baseline client contract plus default tracing at the outbound HTTP boundary.


### Design

## Problem Statement

The starter now has a telemetry boundary, but outbound HTTP access still lacks a first-class shared contract. Without a canonical client, future projects will drift into one-off `fetch` wrappers, inconsistent auth/header handling, and inconsistent tracing of external API calls.

The right place to stop that drift is `packages/core/src/api-client.ts`. That file already exists, but it needs to be upgraded from copied reference material into a reusable project boundary.

## Recommended Architecture

Build one shared outbound client factory in `packages/core/src/api-client.ts` and make it the default instrumentation point for external API access.

Recommended shape:

- `createApiClient(options)`
  - returns typed `request`, `get`, `post`, `put`, `delete`, and optionally `patch`
- `ApiClientOptions`
  - `baseUrl`
  - `defaultHeaders`
  - `timeoutMs`
  - `fetchImpl`
  - lightweight hooks such as `onRequest` / `onResponse` if needed
- `ApiRequestOptions`
  - `operationName`
  - per-request `headers`
  - `timeoutMs`
  - regular `RequestInit` fields that remain safe to expose

The client should own these concerns:

- URL construction
- header merging
- JSON serialization/deserialization
- timeout/abort behavior
- normalized result or error behavior
- default outbound span creation

## Tracing Contract

Outbound tracing belongs inside the shared client, not at every call site.

Recommended defaults:

- one client span per HTTP request
- default span name: `HTTP {METHOD} {host-or-operation}`
- record method, target host, path template or path, status code, and timeout outcome where available
- set error status on transport failure, timeout, or explicit non-success outcomes the client treats as failures

The shared client should also allow callers to pass an `operationName` so business-oriented span naming does not depend entirely on raw URLs.

## Testing Strategy

Tests should cover:

- URL and header merging
- timeout behavior
- success and failure response handling
- invalid JSON handling
- tracing emitted through the shared client boundary using in-memory exporters or test processors

The test seam should use an injected `fetchImpl` instead of relying on real network access.


### Solution

## Deliverables

1. A redesigned `packages/core/src/api-client.ts` that becomes the default outbound HTTP client boundary.
2. Tests for the client under `packages/core/tests/` following the repo’s one-source-file/one-test-file convention.
3. Telemetry integration inside the client so outbound HTTP tracing is automatic.
4. Documentation updates showing:
   - how to instantiate the client
   - how to make typed requests
   - how to extend it with auth headers or custom metadata

## Suggested Public API

The exact names can vary, but the design should remain close to this level of explicitness:

```ts
interface ApiClientOptions {
    baseUrl: string;
    defaultHeaders?: HeadersInit;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
    timeoutMs?: number;
    operationName?: string;
    headers?: HeadersInit;
}

interface ApiJsonRequestOptions extends ApiRequestOptions {
    body?: unknown;
}
```

And methods such as:

- `request<T>(path, options)`
- `get<T>(path, options)`
- `post<T>(path, body, options)`
- `put<T>(path, body, options)`
- `delete<T>(path, options)`

## Error Model

Pick one clear model and document it. Either:

- always return a typed envelope with `status`, `data`, and `error`, or
- throw for transport/timeout failures and return typed data for HTTP success/failure cases

Do not leave mixed behavior implicit. Future projects will depend on this contract.

## Definition of Done

- shared client is reusable and tested
- outbound HTTP spans are emitted by default
- no direct telemetry code is required at normal call sites
- docs are updated where developers will find them
- `bun run check` passes


### Plan

## Phase 1: finalize contract

1. Read the current `packages/core/src/api-client.ts` and identify which parts are article-shaped rather than repo-shaped.
2. Lock the public API surface and error contract.
3. Decide the default span naming and attribute set for outbound calls.

## Phase 2: implement shared client

1. Refactor `packages/core/src/api-client.ts` around the agreed factory and request contract.
2. Add timeout, JSON handling, request metadata, and `fetchImpl` injection.
3. Wire tracing into the shared request path.

## Phase 3: verify and document

1. Add source-matching tests for the client.
2. Verify tracing through in-memory telemetry test seams.
3. Update starter-facing docs and examples.
4. Run `bun run check`.

## Exit Criteria

- client contract is explicit and stable
- outbound tracing is centralized in the shared client
- no raw `fetch` examples remain as the preferred path for shared outbound API access
- verification and docs are complete


### Review



### Testing



### Artifacts

| Type | Path | Agent | Date |
| ---- | ---- | ----- | ---- |

### References

