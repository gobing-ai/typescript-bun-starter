import { metrics } from '@opentelemetry/api';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

export function createTestMetricsProvider(): {
    provider: MeterProvider;
    reader: PeriodicExportingMetricReader;
} {
    const exporter = new InMemoryMetricExporter();
    const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 100_000 });
    const provider = new MeterProvider({ readers: [reader] });
    metrics.disable();
    metrics.setGlobalMeterProvider(provider);
    return { provider, reader };
}

export async function flushAndCollect(reader: PeriodicExportingMetricReader): Promise<Map<string, number>> {
    const result = await reader.collect();
    const counts = new Map<string, number>();
    for (const scopeMetrics of result.resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
            const name = metric.descriptor.name;
            let total = 0;
            for (const dp of metric.dataPoints) {
                if (typeof dp.value === 'number' || typeof dp.value === 'object') {
                    total +=
                        typeof dp.value === 'number' ? dp.value : ((dp.value as Record<string, number>).count ?? 0);
                }
            }
            counts.set(name, (counts.get(name) ?? 0) + total);
        }
    }
    return counts;
}
