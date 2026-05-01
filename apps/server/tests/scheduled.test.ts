// @starter/server — tests for Cloudflare Cron Triggers handler

import { afterEach, describe, expect, it, mock } from 'bun:test';

describe('scheduled.ts', () => {
    afterEach(() => {
        mock.restore();
    });

    const modPromise = import('../src/scheduled');
    const dummyHandler = async (_time: number, _cron: string) => {};

    // ── scheduled() dispatches to correct handler ───────────────────────

    it('scheduled() invokes the matching job handler by cron expression', async () => {
        const mod = await modPromise;

        let handlerCalled = false;
        const uniqueName = `dispatch-test-${Date.now()}`;
        const scheduler = await mod.getScheduler();
        scheduler.register({
            name: uniqueName,
            schedule: '*/5 * * * *',
            handler: async () => {
                handlerCalled = true;
            },
        });

        const mockCtx = { waitUntil: mock((_p: Promise<unknown>) => {}) };
        const mockEvent = {
            cron: '*/5 * * * *',
            scheduledTime: Date.now(),
            type: 'scheduled' as const,
        };

        await mod.scheduled(mockEvent, {}, mockCtx as unknown as ExecutionContext);

        expect(handlerCalled).toBe(true);
        expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1);
    });

    it('scheduled() handles handler rejection without throwing', async () => {
        const mod = await modPromise;

        const scheduler = await mod.getScheduler();
        const failingName = `failing-${Date.now()}`;
        scheduler.register({
            name: failingName,
            schedule: '0 0 1 1 *',
            handler: async () => {
                throw new Error('job failure');
            },
        });

        let capturedPromise: Promise<unknown> | null = null;
        const mockCtx = {
            waitUntil: mock((p: Promise<unknown>) => {
                capturedPromise = p;
            }),
        };
        const mockEvent = {
            cron: '0 0 1 1 *',
            scheduledTime: Date.now(),
            type: 'scheduled' as const,
        };

        await mod.scheduled(mockEvent, {}, mockCtx as unknown as ExecutionContext);

        expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1);
        expect(capturedPromise).not.toBeNull();
        if (capturedPromise) {
            await expect(capturedPromise).resolves.toBeUndefined();
        }
    });

    it('scheduled() warns when no job matches the cron expression', async () => {
        const mod = await modPromise;

        const mockCtx = { waitUntil: mock((_p: Promise<unknown>) => {}) };
        const mockEvent = {
            cron: '59 23 31 12 *',
            scheduledTime: Date.now(),
            type: 'scheduled' as const,
        };

        await mod.scheduled(mockEvent, {}, mockCtx as unknown as ExecutionContext);

        expect(mockCtx.waitUntil).toHaveBeenCalledTimes(0);
    });

    // ── Multiple job registration ───────────────────────────────────────

    it('getJobByCron returns the correct handler for registered cron', async () => {
        const mod = await modPromise;
        const scheduler = await mod.getScheduler();
        const suffix = Date.now();

        scheduler.register({ name: `midnight-${suffix}`, schedule: '0 0 * * *', handler: dummyHandler });
        scheduler.register({ name: `noon-${suffix}`, schedule: '0 12 * * *', handler: dummyHandler });

        const midnightJob = scheduler.getJobByCron('0 0 * * *');
        const noonJob = scheduler.getJobByCron('0 12 * * *');
        const unknownJob = scheduler.getJobByCron('59 23 31 12 *');

        expect(midnightJob?.name).toBe(`midnight-${suffix}`);
        expect(noonJob?.name).toBe(`noon-${suffix}`);
        expect(unknownJob).toBeUndefined();
    });

    // ── Duplicate job name throws ───────────────────────────────────────

    it('throws when registering a duplicate job name', async () => {
        const mod = await modPromise;
        const scheduler = await mod.getScheduler();
        const name = `duplicate-${Date.now()}`;

        scheduler.register({ name, schedule: '0 0 * * *', handler: dummyHandler });

        expect(() => scheduler.register({ name, schedule: '0 0 * * *', handler: dummyHandler })).toThrow(
            `Job with name "${name}" is already registered`,
        );
    });
});
