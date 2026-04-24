/**
 * OpenTelemetry SDK initialization for Bun runtime.
 *
 * Provides a single `initTelemetry()` entry point that wires the tracer
 * provider, resource attributes, and exporter. When telemetry is disabled,
 * initialization becomes a no-op. When no exporter endpoint is configured,
 * the SDK still supports spans locally but does not attempt remote export.
 *
 * Downstream code should use helpers from `tracing.ts` instead of importing
 * the SDK directly.
 */

import { context, diag, propagation, type Tracer, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getTelemetryConfig, type TelemetryConfig } from './config';

let provider: NodeTracerProvider | undefined;
let initialized = false;
let resolvedConfig: TelemetryConfig | undefined;

export interface TelemetryInitOptions {
    spanProcessors?: SpanProcessor[];
}

/**
 * Initialize the OpenTelemetry SDK.
 *
 * Call once at application startup. Safe to call multiple times — subsequent
 * calls after the first successful init are no-ops that return the existing
 * tracer provider.
 *
 * @param config - Optional overrides; defaults to `getTelemetryConfig()`.
 * @param options - Internal wiring overrides used mainly by targeted tests.
 * @returns The resolved `TelemetryConfig` used during initialization.
 */
export function initTelemetry(config?: Partial<TelemetryConfig>, options: TelemetryInitOptions = {}): TelemetryConfig {
    if (initialized) {
        return resolvedConfig ?? getTelemetryConfig();
    }

    const resolved = { ...getTelemetryConfig(), ...config };
    resolvedConfig = resolved;

    if (!resolved.enabled) {
        initialized = true;
        return resolved;
    }

    const baseResource = defaultResource();
    const serviceResource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: resolved.serviceName,
        [ATTR_SERVICE_VERSION]: '0.1.0',
        'service.environment': resolved.environment,
    });
    const resource = baseResource.merge(serviceResource);

    const traceExporter = resolved.exporterEndpoint
        ? new OTLPTraceExporter({ url: resolved.exporterEndpoint })
        : undefined;
    const spanProcessors = options.spanProcessors ?? (traceExporter ? [new BatchSpanProcessor(traceExporter)] : []);
    const contextManager = new AsyncHooksContextManager();
    contextManager.enable();

    provider = new NodeTracerProvider({
        resource,
        spanProcessors,
    });
    provider.register({ contextManager });
    initialized = true;
    return resolved;
}

/**
 * Shut down the SDK and flush pending spans.
 *
 * Call during graceful shutdown. Returns a promise that resolves when all
 * buffered telemetry has been exported (or the timeout is reached).
 */
export async function shutdownTelemetry(): Promise<void> {
    if (!provider) {
        initialized = false;
        resolvedConfig = undefined;
        return;
    }
    await provider.shutdown();
    provider = undefined;
    initialized = false;
    resolvedConfig = undefined;
}

/**
 * Get a named tracer for creating spans.
 *
 * Falls back to a no-op tracer when telemetry is not initialized.
 */
export function getTracer(name = '@starter/core', version = '0.1.0'): Tracer {
    return trace.getTracer(name, version);
}

/**
 * Reset internal state. For testing only.
 */
export function _resetTelemetry(): void {
    initialized = false;
    resolvedConfig = undefined;
    if (provider) {
        try {
            provider.shutdown();
        } catch {
            // swallow
        }
        provider = undefined;
    }
    // Clear global OTel state so tests get a clean slate
    trace.disable();
    context.disable();
    propagation.disable();
    diag.disable();
}

/** Check whether the SDK has been initialized. */
export function isTelemetryInitialized(): boolean {
    return initialized;
}

/**
 * Get the resolved telemetry config.
 *
 * Returns the config used during the last `initTelemetry()` call,
 * or falls back to reading from env if telemetry has not been initialized.
 */
export function getResolvedConfig(): TelemetryConfig {
    return resolvedConfig ?? getTelemetryConfig();
}

// Re-export propagation utilities for downstream use
export { context, diag, propagation, trace };
