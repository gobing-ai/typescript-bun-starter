/**
 * Cloudflare Workers Cron Trigger handler.
 *
 * Register scheduled jobs here and export the `scheduled` handler
 * that Cloudflare invokes for cron triggers defined in wrangler.toml.
 *
 * Example:
 *   scheduler.register({
 *     name: 'my-job',
 *     schedule: '0 0 * * *',
 *     handler: async (scheduledTime, cronExpression) => {
 *       logger.info('Job running', { scheduledTime, cronExpression });
 *     },
 *   });
 */

import { CloudflareSchedulerAdapter, initScheduler, logger } from '@starter/core';

const scheduler = initScheduler({ mode: 'cloudflare' }) as CloudflareSchedulerAdapter;

// ── Register scheduled jobs below ──────────────────────────────────────

interface ScheduledEvent {
    cron: string;
    scheduledTime: number;
}

interface CfEnv {
    DB?: unknown;
    SESSION?: unknown;
    API_KEY?: string;
}

interface CfExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
}

export async function scheduled(
    event: ScheduledEvent,
    env: CfEnv,
    ctx: CfExecutionContext,
): Promise<void> {
    logger.info('Cloudflare cron trigger fired', {
        cron: event.cron,
        scheduledTime: event.scheduledTime,
    });

    const job = scheduler.getJobByCron(event.cron);
    if (!job) {
        logger.warn('No job registered for cron expression', { cron: event.cron });
        return;
    }

    logger.info('Dispatching scheduled job', { job: job.name, cron: event.cron });

    ctx.waitUntil(
        job.handler(event.scheduledTime, event.cron).catch((err) => {
            logger.error('Scheduled job failed', { job: job.name, error: String(err) });
        }),
    );
}
