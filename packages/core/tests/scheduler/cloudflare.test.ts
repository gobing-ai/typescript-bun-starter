import { describe, expect, it } from 'bun:test';
import { CloudflareSchedulerAdapter } from '../../src/scheduler/cloudflare';

describe('CloudflareSchedulerAdapter', () => {
    const handler = async (_time: number, _cron: string) => {};

    it('registers a job and returns it in getJobs', () => {
        const adapter = new CloudflareSchedulerAdapter();
        adapter.register({ name: 'daily-cleanup', schedule: '0 0 * * *', handler });

        expect(adapter.getJobs()).toEqual(['daily-cleanup']);
    });

    it('throws when registering a duplicate job name', () => {
        const adapter = new CloudflareSchedulerAdapter();
        adapter.register({ name: 'daily-cleanup', schedule: '0 0 * * *', handler });

        expect(() => adapter.register({ name: 'daily-cleanup', schedule: '0 6 * * *', handler })).toThrow(
            'Job with name "daily-cleanup" is already registered',
        );
    });

    it('start and stop are no-ops', async () => {
        const adapter = new CloudflareSchedulerAdapter();
        adapter.register({ name: 'test-job', schedule: '* * * * *', handler });

        await adapter.start();
        expect(adapter.getJobs()).toContain('test-job');

        await adapter.stop();
        expect(adapter.getJobs()).toContain('test-job');
    });

    it('getJobHandler returns the handler for a registered job', () => {
        const adapter = new CloudflareSchedulerAdapter();
        adapter.register({ name: 'my-job', schedule: '0 0 * * *', handler });

        expect(adapter.getJobHandler('my-job')).toBe(handler);
    });

    it('getJobHandler returns undefined for unknown job', () => {
        const adapter = new CloudflareSchedulerAdapter();
        expect(adapter.getJobHandler('nope')).toBeUndefined();
    });

    it('getJobByCron finds a job by its cron expression', () => {
        const adapter = new CloudflareSchedulerAdapter();
        adapter.register({ name: 'midnight', schedule: '0 0 * * *', handler });

        const job = adapter.getJobByCron('0 0 * * *');
        expect(job?.name).toBe('midnight');
    });

    it('getJobByCron returns undefined when no job matches', () => {
        const adapter = new CloudflareSchedulerAdapter();
        expect(adapter.getJobByCron('* * * * *')).toBeUndefined();
    });

    it('returns empty array when no jobs registered', () => {
        const adapter = new CloudflareSchedulerAdapter();
        expect(adapter.getJobs()).toEqual([]);
    });
});
