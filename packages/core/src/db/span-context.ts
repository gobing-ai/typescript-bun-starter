import { AsyncLocalStorage } from 'node:async_hooks';
import type { Span } from '@opentelemetry/api';

const dbSpanStorage = new AsyncLocalStorage<Span>();

export function runWithDbSpan<T>(span: Span, fn: () => Promise<T>): Promise<T> {
    return dbSpanStorage.run(span, fn);
}

export function getCurrentDbSpan(): Span | undefined {
    return dbSpanStorage.getStore();
}
