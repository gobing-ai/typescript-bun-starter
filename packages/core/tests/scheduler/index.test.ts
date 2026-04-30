import { describe, expect, test } from 'bun:test';
import * as barrel from '../../src/scheduler/index';

describe('scheduler barrel (index.ts)', () => {
    test('exports CloudflareSchedulerAdapter', () => {
        expect(barrel.CloudflareSchedulerAdapter).toBeDefined();
        expect(typeof barrel.CloudflareSchedulerAdapter).toBe('function');
    });

    test('exports NodeSchedulerAdapter', () => {
        expect(barrel.NodeSchedulerAdapter).toBeDefined();
        expect(typeof barrel.NodeSchedulerAdapter).toBe('function');
    });

    test('exports NoOpSchedulerAdapter', () => {
        expect(barrel.NoOpSchedulerAdapter).toBeDefined();
        expect(typeof barrel.NoOpSchedulerAdapter).toBe('function');
    });

    test('exports initScheduler', () => {
        expect(barrel.initScheduler).toBeDefined();
        expect(typeof barrel.initScheduler).toBe('function');
    });
});
