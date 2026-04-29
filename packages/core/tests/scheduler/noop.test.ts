import { describe, expect, it } from 'bun:test';
import { NoOpSchedulerAdapter } from '../../src/scheduler/noop';

describe('NoOpSchedulerAdapter', () => {
    const handler = async (_time: number, _cron: string) => {};

    it('tracks registered job names', () => {
        const adapter = new NoOpSchedulerAdapter();
        adapter.register({ name: 'job-a', schedule: '0 0 * * *', handler });
        adapter.register({ name: 'job-b', schedule: '0 6 * * *', handler });

        expect(adapter.getJobs()).toEqual(['job-a', 'job-b']);
    });

    it('start and stop are no-ops', async () => {
        const adapter = new NoOpSchedulerAdapter();
        adapter.register({ name: 'test', schedule: '* * * * *', handler });

        await adapter.start();
        await adapter.stop();
        expect(adapter.getJobs()).toEqual(['test']);
    });

    it('returns empty array when no jobs registered', () => {
        const adapter = new NoOpSchedulerAdapter();
        expect(adapter.getJobs()).toEqual([]);
    });

    it('getJobs returns a copy, not the internal array', () => {
        const adapter = new NoOpSchedulerAdapter();
        adapter.register({ name: 'original', schedule: '0 0 * * *', handler });

        const jobs = adapter.getJobs();
        jobs.push('injected');

        expect(adapter.getJobs()).toEqual(['original']);
    });
});
