import { describe, expect, test } from 'bun:test';
import { queueJobs } from '../../../src/db/schema/queue-jobs';

describe('schema/queue-jobs.ts', () => {
    test('queueJobs table is defined', () => {
        expect(queueJobs).toBeDefined();
    });

    test('has all required columns', () => {
        expect(queueJobs.id).toBeDefined();
        expect(queueJobs.type).toBeDefined();
        expect(queueJobs.payload).toBeDefined();
        expect(queueJobs.status).toBeDefined();
        expect(queueJobs.attempts).toBeDefined();
        expect(queueJobs.maxRetries).toBeDefined();
    });

    test('has optional columns', () => {
        expect(queueJobs.nextRetryAt).toBeDefined();
        expect(queueJobs.lastError).toBeDefined();
        expect(queueJobs.processingAt).toBeDefined();
    });

    test('includes standardColumns', () => {
        expect(queueJobs.createdAt).toBeDefined();
        expect(queueJobs.updatedAt).toBeDefined();
    });
});
