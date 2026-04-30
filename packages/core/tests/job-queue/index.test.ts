import { describe, expect, test } from 'bun:test';
import * as barrel from '../../src/job-queue/index';

describe('job-queue barrel (index.ts)', () => {
    test('exports DBQueueConsumer', () => {
        expect(barrel.DBQueueConsumer).toBeDefined();
        expect(typeof barrel.DBQueueConsumer).toBe('function');
    });

    test('exports DBJobQueue', () => {
        expect(barrel.DBJobQueue).toBeDefined();
        expect(typeof barrel.DBJobQueue).toBe('function');
    });
});
