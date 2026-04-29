import { afterEach, describe, expect, it } from 'bun:test';
import { CloudflareSchedulerAdapter } from '../../src/scheduler/cloudflare';
import { initScheduler } from '../../src/scheduler/factory';
import { NodeSchedulerAdapter } from '../../src/scheduler/node';
import { NoOpSchedulerAdapter } from '../../src/scheduler/noop';

describe('initScheduler', () => {
    afterEach(() => {
        delete process.env.SCHEDULER_ENABLED;
        delete process.env.APP_MODE;
    });

    it('returns NoOp when SCHEDULER_ENABLED is "false"', () => {
        process.env.SCHEDULER_ENABLED = 'false';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NoOpSchedulerAdapter);
    });

    it('returns NoOp when options.enabled is false', () => {
        const scheduler = initScheduler({ enabled: false });
        expect(scheduler).toBeInstanceOf(NoOpSchedulerAdapter);
    });

    it('returns Cloudflare adapter when APP_MODE is cloudflare', () => {
        process.env.APP_MODE = 'cloudflare';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(CloudflareSchedulerAdapter);
    });

    it('returns Cloudflare adapter when options.mode is cloudflare', () => {
        const scheduler = initScheduler({ mode: 'cloudflare' });
        expect(scheduler).toBeInstanceOf(CloudflareSchedulerAdapter);
    });

    it('returns Node adapter when APP_MODE is node (explicit)', () => {
        process.env.APP_MODE = 'node';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('returns Node adapter when APP_MODE is local', () => {
        process.env.APP_MODE = 'local';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('returns Node adapter when APP_MODE is vps', () => {
        process.env.APP_MODE = 'vps';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('returns Node adapter by default (no env set)', () => {
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('returns Node adapter for unknown APP_MODE with fallback', () => {
        process.env.APP_MODE = 'some-future-mode';
        const scheduler = initScheduler();
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('options override env vars', () => {
        process.env.APP_MODE = 'cloudflare';
        const scheduler = initScheduler({ mode: 'node' });
        expect(scheduler).toBeInstanceOf(NodeSchedulerAdapter);
    });

    it('options.enabled=false overrides env', () => {
        process.env.SCHEDULER_ENABLED = 'true';
        process.env.APP_MODE = 'cloudflare';
        const scheduler = initScheduler({ enabled: false });
        expect(scheduler).toBeInstanceOf(NoOpSchedulerAdapter);
    });
});
