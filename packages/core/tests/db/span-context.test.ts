import { describe, expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import { getCurrentDbSpan, runWithDbSpan } from '../../src/db/span-context';
import { cleanupTestProvider, createTestProvider } from '../telemetry/test-helpers';

describe('db span context', () => {
    test('stores and exposes the current DB span for the active async flow', async () => {
        const { provider } = createTestProvider();
        const tracer = trace.getTracer('test-db-span-context');

        try {
            await tracer.startActiveSpan('db.test', async (span) => {
                await runWithDbSpan(span, async () => {
                    expect(getCurrentDbSpan()).toBe(span);
                    await Promise.resolve();
                    expect(getCurrentDbSpan()).toBe(span);
                });
                span.end();
            });
        } finally {
            await cleanupTestProvider(provider);
        }
    });

    test('returns undefined outside a DB span context', () => {
        expect(getCurrentDbSpan()).toBeUndefined();
    });
});
