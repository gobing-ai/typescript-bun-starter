import { context, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function createTestProvider(): { provider: BasicTracerProvider; exporter: InMemorySpanExporter } {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

    trace.setGlobalTracerProvider(provider);

    const contextManager = new AsyncHooksContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);

    return { provider, exporter };
}

export async function cleanupTestProvider(provider: BasicTracerProvider): Promise<void> {
    await provider.shutdown();
    trace.disable();
}
