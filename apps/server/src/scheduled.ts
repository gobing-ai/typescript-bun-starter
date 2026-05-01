/**
 * Cloudflare Workers Cron Trigger handler.
 *
 * This module registers scheduled jobs and exports the `scheduled` handler
 * that Cloudflare invokes for cron triggers defined in wrangler.toml.
 *
 * Usage:
 *   1. Register jobs below via `scheduler.register(...)`.
 *   2. Define matching cron triggers in `apps/server/wrangler.toml`.
 *   3. The `scheduled` export is automatically called by the CF runtime.
 *
 * This file is only meaningful in CF Workers deployments.
 * In Bun/Node runs the scheduler is managed by the NodeSchedulerAdapter
 * (in-process node-cron) and this module is never loaded by the runtime.
 */

import { CloudflareSchedulerAdapter, initScheduler, logger } from '@starter/core';

// ── Create the registry-based scheduler ────────────────────────────────
const scheduler = initScheduler({ mode: 'cloudflare' }) as CloudflareSchedulerAdapter;

// ── Register scheduled jobs ────────────────────────────────────────────
//
// Example:
//   scheduler.register({
//     name: 'daily-cleanup',
//     schedule: '0 0 * * *',
//     handler: async (scheduledTime, cronExpression) => {
//       logger.info('Running daily cleanup', { scheduledTime, cronExpression });
//     },
//   });

// ── Scheduled event handler ────────────────────────────────────────────
//
// Cloudflare invokes this export for every cron trigger.
// We dispatch by cron expression to find and run the matching job.

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

    logger.info('Dispatching scheduled job', {
        job: job.name,
        cron: event.cron,
    });

    ctx.waitUntil(
        job.handler(event.scheduledTime, event.cron).catch((err) => {
            logger.error('Scheduled job failed', { job: job.name, error: String(err) });
        }),
    );
}
