/**
 * OpenTelemetry metrics initialization and instrument definitions.
 *
 * Provides a centralized metrics boundary for the three default operational
 * surfaces: inbound HTTP, outbound HTTP, and DB operations. All instruments
 * are created lazily and degrade to no-ops when telemetry is disabled.
 *
 * @module telemetry/metrics
 */

import { type Counter, type Histogram, metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { MeterProvider, type MetricReader, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getTelemetryConfig, type TelemetryConfig } from './config';

// ---------------------------------------------------------------------------
// MeterProvider lifecycle
// ---------------------------------------------------------------------------

let meterProvider: MeterProvider | undefined;
let metricsInitialized = false;

export interface MetricsInitOptions {
    metricReaders?: MetricReader[];
}

/**
 * Initialize the metrics subsystem.
 *
 * Call after `initTelemetry()`. When telemetry is disabled, becomes a no-op.
 * When no exporter endpoint is configured, a periodic reader is still attached
 * so instruments accumulate values readable via `collect()` in tests.
 *
 * @param config - Optional overrides; defaults to `getTelemetryConfig()`.
 * @param options - Internal wiring overrides for testing.
 */
export function initMetrics(config?: Partial<TelemetryConfig>, options: MetricsInitOptions = {}): void {
    if (metricsInitialized) {
        return;
    }

    const resolved = { ...getTelemetryConfig(), ...config };

    if (!resolved.enabled) {
        metricsInitialized = true;
        return;
    }

    const metricReaders: MetricReader[] = [];

    if (resolved.exporterEndpoint) {
        metricReaders.push(
            new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter({ url: resolved.exporterEndpoint }),
                exportIntervalMillis: 10_000,
            }),
        );
    }

    if (options.metricReaders) {
        metricReaders.push(...options.metricReaders);
    }

    meterProvider = new MeterProvider({ readers: metricReaders });
    metricsInitialized = true;
}

/**
 * Shut down the metrics provider and flush pending exports.
 */
export async function shutdownMetrics(): Promise<void> {
    if (!meterProvider) {
        metricsInitialized = false;
        return;
    }
    await meterProvider.shutdown();
    meterProvider = undefined;
    metricsInitialized = false;
}

/**
 * Reset internal state. For testing only.
 *
 * Resets the meter provider and clears cached instrument references
 * so subsequent calls create fresh instruments against the new provider.
 */
export function _resetMetrics(): void {
    if (meterProvider) {
        try {
            meterProvider.shutdown();
        } catch {
            // swallow
        }
        meterProvider = undefined;
    }
    metricsInitialized = false;
    // Clear cached instruments so they're recreated against the next provider
    for (const key of Object.keys(instruments) as (keyof typeof instruments)[]) {
        instruments[key] = undefined;
    }
    // Reset global OTel metrics state so tests can register a fresh provider
    metrics.disable();
}

/** Check whether metrics have been initialized. */
export function isMetricsInitialized(): boolean {
    return metricsInitialized;
}

/**
 * Get the configured MeterProvider.
 *
 * Returns the explicit provider when initialized, or falls back to the
 * global (noop) provider registered by the OTel API.
 */
export function getMeterProvider(): MeterProvider {
    return meterProvider ?? (metrics.getMeterProvider() as MeterProvider);
}

// ---------------------------------------------------------------------------
// Instrument registry
// ---------------------------------------------------------------------------

const METER_NAME = '@starter/core';
const METER_VERSION = '0.1.0';

function getMeter() {
    return getMeterProvider().getMeter(METER_NAME, METER_VERSION);
}

/**
 * Baseline metric instrument definitions.
 *
 * Each instrument is created lazily on first access and cached. When no
 * MeterProvider is configured, all operations degrade to no-ops.
 */
const instruments: {
    httpServerRequestTotal: Counter | undefined;
    httpServerRequestDuration: Histogram | undefined;
    httpServerRequestErrors: Counter | undefined;
    httpClientRequestTotal: Counter | undefined;
    httpClientRequestDuration: Histogram | undefined;
    httpClientRequestErrors: Counter | undefined;
    dbOperationTotal: Counter | undefined;
    dbOperationDuration: Histogram | undefined;
    dbOperationErrors: Counter | undefined;
} = {
    httpServerRequestTotal: undefined,
    httpServerRequestDuration: undefined,
    httpServerRequestErrors: undefined,
    httpClientRequestTotal: undefined,
    httpClientRequestDuration: undefined,
    httpClientRequestErrors: undefined,
    dbOperationTotal: undefined,
    dbOperationDuration: undefined,
    dbOperationErrors: undefined,
};

// Lazy-initialization getters

/** Counter: total inbound HTTP server requests. Attributes: `http.request.method`, `http.response.status_code`. */
export function getHttpServerRequestTotal(): Counter {
    if (!instruments.httpServerRequestTotal) {
        instruments.httpServerRequestTotal = getMeter().createCounter('http.server.request.total', {
            description: 'Total number of inbound HTTP server requests',
            unit: '{request}',
        });
    }
    return instruments.httpServerRequestTotal;
}

/** Histogram: inbound HTTP server request duration (ms). Attributes: `http.request.method`, `http.response.status_code`. */
export function getHttpServerRequestDuration(): Histogram {
    if (!instruments.httpServerRequestDuration) {
        instruments.httpServerRequestDuration = getMeter().createHistogram('http.server.request.duration', {
            description: 'Duration of inbound HTTP server requests',
            unit: 'ms',
        });
    }
    return instruments.httpServerRequestDuration;
}

/** Counter: inbound HTTP server errors (5xx). Attributes: `http.request.method`, `http.response.status_code`. */
export function getHttpServerRequestErrors(): Counter {
    if (!instruments.httpServerRequestErrors) {
        instruments.httpServerRequestErrors = getMeter().createCounter('http.server.request.errors', {
            description: 'Total number of inbound HTTP server requests that resulted in a server error (5xx)',
            unit: '{error}',
        });
    }
    return instruments.httpServerRequestErrors;
}

/** Counter: total outbound HTTP client requests. Attributes: `http.request.method`, `http.response.status_code`. */
export function getHttpClientRequestTotal(): Counter {
    if (!instruments.httpClientRequestTotal) {
        instruments.httpClientRequestTotal = getMeter().createCounter('http.client.request.total', {
            description: 'Total number of outbound HTTP client requests',
            unit: '{request}',
        });
    }
    return instruments.httpClientRequestTotal;
}

/** Histogram: outbound HTTP client request duration (ms). Attributes: `http.request.method`, `http.response.status_code`. */
export function getHttpClientRequestDuration(): Histogram {
    if (!instruments.httpClientRequestDuration) {
        instruments.httpClientRequestDuration = getMeter().createHistogram('http.client.request.duration', {
            description: 'Duration of outbound HTTP client requests',
            unit: 'ms',
        });
    }
    return instruments.httpClientRequestDuration;
}

/** Counter: outbound HTTP client errors. Attributes: `http.request.method`, `error.type`. */
export function getHttpClientRequestErrors(): Counter {
    if (!instruments.httpClientRequestErrors) {
        instruments.httpClientRequestErrors = getMeter().createCounter('http.client.request.errors', {
            description: 'Total number of outbound HTTP client requests that resulted in an error',
            unit: '{error}',
        });
    }
    return instruments.httpClientRequestErrors;
}

/** Counter: total database operations. Attributes: `db.operation`, `db.collection`. */
export function getDbOperationTotal(): Counter {
    if (!instruments.dbOperationTotal) {
        instruments.dbOperationTotal = getMeter().createCounter('db.client.operation.total', {
            description: 'Total number of database operations',
            unit: '{operation}',
        });
    }
    return instruments.dbOperationTotal;
}

/** Histogram: database operation duration (ms). Attributes: `db.operation`, `db.collection`. */
export function getDbOperationDuration(): Histogram {
    if (!instruments.dbOperationDuration) {
        instruments.dbOperationDuration = getMeter().createHistogram('db.client.operation.duration', {
            description: 'Duration of database operations',
            unit: 'ms',
        });
    }
    return instruments.dbOperationDuration;
}

/** Counter: database operation errors. Attributes: `db.operation`, `db.collection`, `error.type`. */
export function getDbOperationErrors(): Counter {
    if (!instruments.dbOperationErrors) {
        instruments.dbOperationErrors = getMeter().createCounter('db.client.operation.errors', {
            description: 'Total number of database operations that resulted in an error',
            unit: '{error}',
        });
    }
    return instruments.dbOperationErrors;
}
