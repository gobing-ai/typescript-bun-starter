/**
 * High-level tracing helpers for application code.
 *
 * These are the primary public API for instrumenting domain flows.
 * All helpers degrade to plain execution when telemetry is disabled.
 *
 * @example
 * ```ts
 * import { traceAsync, addSpanAttributes } from '@starter/core';
 *
 * const result = await traceAsync('db.query', async (span) => {
 *     addSpanAttributes({ 'db.system': 'sqlite', 'db.operation': 'SELECT' });
 *     return db.select().from(skills);
 * });
 * ```
 */

import { context, type Span, type SpanOptions, type Tracer, trace } from '@opentelemetry/api';
import { getTracer } from './sdk';

/**
 * Run an async function inside a new span.
 *
 * The span is automatically ended when the callback resolves (or rejects).
 * If telemetry is disabled, the callback runs without a span.
 *
 * @param name - Span name (e.g. `'http.request'`, `'db.query'`).
 * @param fn - Async callback receiving the active span.
 * @param options - Optional `SpanOptions` (kind, attributes, links).
 * @param tracer - Optional tracer override; defaults to `@starter/core`.
 */
export async function traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: SpanOptions,
    tracer?: Tracer,
): Promise<T> {
    const resolvedTracer = tracer ?? getTracer();
    return resolvedTracer.startActiveSpan(name, options ?? {}, async (span) => {
        try {
            return await fn(span);
        } catch (err) {
            span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) }); // ERROR
            throw err;
        } finally {
            span.end();
        }
    });
}

/**
 * Run a synchronous function inside a new span.
 *
 * @param name - Span name.
 * @param fn - Sync callback receiving the active span.
 * @param options - Optional `SpanOptions`.
 * @param tracer - Optional tracer override.
 */
export function traceSync<T>(name: string, fn: (span: Span) => T, options?: SpanOptions, tracer?: Tracer): T {
    const resolvedTracer = tracer ?? getTracer();
    return resolvedTracer.startActiveSpan(name, options ?? {}, (span) => {
        try {
            return fn(span);
        } catch (err) {
            span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) });
            throw err;
        } finally {
            span.end();
        }
    });
}

/**
 * Add attributes to the currently active span.
 *
 * No-op when there is no active span or telemetry is disabled.
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span?.isRecording()) {
        span.setAttributes(attributes);
    }
}

/**
 * Add an event to the currently active span.
 *
 * No-op when there is no active span or telemetry is disabled.
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span?.isRecording()) {
        span.addEvent(name, attributes);
    }
}

/**
 * Get the currently active span, or `undefined` if none.
 */
export function getActiveSpan(): Span | undefined {
    return trace.getActiveSpan() ?? undefined;
}

/**
 * Run a function with a span set as the active context.
 *
 * Useful for propagating context across async boundaries that the automatic
 * context manager doesn't cover.
 */
export function withSpan<T>(span: Span, fn: () => T): T {
    return context.with(trace.setSpan(context.active(), span), fn);
}

export type { Span, SpanOptions, Tracer } from '@opentelemetry/api';
export { context, propagation, trace } from './sdk';
