import { describe, expect, test } from 'bun:test';
import * as barrel from '../../../src/db/schema';

describe('schema barrel (index.ts)', () => {
    test('re-exports standardColumns from common.ts', () => {
        expect(barrel.standardColumns).toBeDefined();
        expect(barrel.standardColumns.createdAt).toBeDefined();
        expect(barrel.standardColumns.updatedAt).toBeDefined();
    });

    test('re-exports standardColumnsWithSoftDelete from common.ts', () => {
        expect(barrel.standardColumnsWithSoftDelete).toBeDefined();
        expect(barrel.standardColumnsWithSoftDelete.inUsed).toBeDefined();
    });

    test('re-exports buildStandardColumns', () => {
        expect(typeof barrel.buildStandardColumns).toBe('function');
    });

    test('re-exports buildStandardColumnsWithSoftDelete', () => {
        expect(typeof barrel.buildStandardColumnsWithSoftDelete).toBe('function');
    });

    test('re-exports nowTimestamp', () => {
        expect(typeof barrel.nowTimestamp).toBe('function');
        expect(barrel.nowTimestamp()).toBeNumber();
    });

    test('re-exports queueJobs table from queue-jobs.ts', () => {
        expect(barrel.queueJobs).toBeDefined();
        expect(barrel.queueJobs.id).toBeDefined();
        expect(barrel.queueJobs.type).toBeDefined();
        expect(barrel.queueJobs.payload).toBeDefined();
        expect(barrel.queueJobs.status).toBeDefined();
    });
});
