import { afterEach, describe, expect, it, mock } from 'bun:test';
import { NodeSchedulerAdapter } from '../../src/scheduler/node';
import type { ScheduledJobHandler } from '../../src/scheduler/types';

const handler: ScheduledJobHandler = async (_time: number, _cron: string) => {};

describe('NodeSchedulerAdapter', () => {
    let adapter: NodeSchedulerAdapter;

    afterEach(() => {
        mock.restore();
    });

    // ── register ──────────────────────────────────────────────────────

    it('register adds a job and returns it in getJobs', () => {
        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'daily', schedule: '0 0 * * *', handler });
        expect(adapter.getJobs()).toEqual(['daily']);
    });

    it('throws when registering a duplicate job name', () => {
        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'daily', schedule: '0 0 * * *', handler });
        expect(() => adapter.register({ name: 'daily', schedule: '0 6 * * *', handler })).toThrow(
            'Job with name "daily" is already registered',
        );
    });

    it('register accepts an optional timezone', () => {
        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'tz-job', schedule: '0 0 * * *', handler, timezone: 'Asia/Tokyo' });
        expect(adapter.getJobs()).toEqual(['tz-job']);
    });

    // ── getJobs ───────────────────────────────────────────────────────

    it('returns empty array when no jobs registered', () => {
        adapter = new NodeSchedulerAdapter();
        expect(adapter.getJobs()).toEqual([]);
    });

    it('returns all registered job names in order', () => {
        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'job-a', schedule: '* * * * *', handler });
        adapter.register({ name: 'job-b', schedule: '0 0 * * *', handler });
        expect(adapter.getJobs()).toEqual(['job-a', 'job-b']);
    });

    // ── isJobRunning ──────────────────────────────────────────────────

    it('isJobRunning returns false before start', () => {
        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'pending', schedule: '* * * * *', handler });
        expect(adapter.isJobRunning('pending')).toBe(false);
    });

    it('isJobRunning returns false for unknown job', () => {
        adapter = new NodeSchedulerAdapter();
        expect(adapter.isJobRunning('nope')).toBe(false);
    });

    // ── start (with mocked node-cron) ─────────────────────────────────

    it('start loads node-cron and schedules registered jobs', async () => {
        const stopFn = mock(() => {});
        const scheduleFn = mock((_expr: string, _fn: () => void, _opts?: { timezone?: string }) => ({
            stop: stopFn,
        }));

        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => true),
                schedule: scheduleFn,
            },
        }));

        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'midnight', schedule: '0 0 * * *', handler });
        adapter.register({ name: 'noon', schedule: '0 12 * * *', handler, timezone: 'UTC' });

        await adapter.start();

        expect(scheduleFn).toHaveBeenCalledTimes(2);
        expect(adapter.isJobRunning('midnight')).toBe(true);
        expect(adapter.isJobRunning('noon')).toBe(true);
    });

    it('invokes the scheduled handler when cron triggers', async () => {
        let capturedCallback: (() => Promise<void>) | null = null;

        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => true),
                schedule: mock((_expr: string, fn: () => Promise<void>, _opts?: { timezone?: string }) => {
                    capturedCallback = fn;
                    return { stop: mock(() => {}) };
                }),
            },
        }));

        let handlerCalled = false;
        adapter = new NodeSchedulerAdapter();
        adapter.register({
            name: 'triggered',
            schedule: '* * * * *',
            handler: async () => {
                handlerCalled = true;
            },
        });

        await adapter.start();
        expect(capturedCallback).not.toBeNull();

        if (capturedCallback) {
            const cb = capturedCallback as () => Promise<void>;
            await cb();
        }
        expect(handlerCalled).toBe(true);
    });

    it('start throws on invalid cron expression', async () => {
        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => false),
                schedule: mock(() => ({ stop: mock(() => {}) })),
            },
        }));

        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'bad', schedule: 'invalid', handler });

        await expect(adapter.start()).rejects.toThrow('Invalid cron expression "invalid" for job "bad"');
    });

    it('start skips jobs that are already running', async () => {
        const scheduleFn = mock((_expr: string, _fn: () => void, _opts?: { timezone?: string }) => ({
            stop: mock(() => {}),
        }));

        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => true),
                schedule: scheduleFn,
            },
        }));

        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'repeat', schedule: '* * * * *', handler });

        await adapter.start();
        const callCountAfterFirst = (scheduleFn as ReturnType<typeof mock>).mock.calls.length;

        // Start again — should skip already-running job
        await adapter.start();
        expect((scheduleFn as ReturnType<typeof mock>).mock.calls.length).toBe(callCountAfterFirst);
    });

    // ── stop ──────────────────────────────────────────────────────────

    it('stop stops all running tasks', async () => {
        const stopFn = mock(() => {});

        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => true),
                schedule: mock((_expr: string, _fn: () => void, _opts?: { timezone?: string }) => ({
                    stop: stopFn,
                })),
            },
        }));

        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'job-1', schedule: '* * * * *', handler });
        adapter.register({ name: 'job-2', schedule: '0 0 * * *', handler });

        await adapter.start();
        await adapter.stop();

        expect(stopFn).toHaveBeenCalledTimes(2);
    });

    it('stop is safe when no jobs are running', async () => {
        adapter = new NodeSchedulerAdapter();
        await adapter.stop(); // should not throw
    });

    // ── start → stop → restart ────────────────────────────────────────

    it('start after stop does not double-schedule (tasks persist)', async () => {
        const scheduleFn = mock((_expr: string, _fn: () => void, _opts?: { timezone?: string }) => ({
            stop: mock(() => {}),
        }));

        mock.module('node-cron', () => ({
            default: {
                validate: mock((_expr: string) => true),
                schedule: scheduleFn,
            },
        }));

        adapter = new NodeSchedulerAdapter();
        adapter.register({ name: 'reboot', schedule: '0 6 * * *', handler });

        await adapter.start();
        await adapter.stop();
        await adapter.start();

        // Schedule only called once — second start skips already-stopped task refs
        expect((scheduleFn as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    });
});
