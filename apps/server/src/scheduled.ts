// @starter/server — Cloudflare Cron Triggers handler
//
// Usage:
//   1. Register your cron jobs by calling getScheduler().register(job).
//   2. Add matching [[triggers]] entries in wrangler.toml.
//   3. Deploy: bun run deploy:server
//
// The CloudflareSchedulerAdapter acts as a registry. At runtime, the
// `scheduled()` export dispatches to the matching job by cron expression.
//
// The scheduler is lazy-initialized via dynamic import to avoid triggering
// LogTape configure during module load (which would conflict with the
// explicit configure() call in index.ts).

import type { CloudflareSchedulerAdapter } from '@starter/core';
import { logger } from '@starter/core';

let _scheduler: CloudflareSchedulerAdapter | null = null;

/** @internal — exported for testing */
export async function getScheduler(): Promise<CloudflareSchedulerAdapter> {
    if (!_scheduler) {
        const { initScheduler } = await import('@starter/core');
        _scheduler = initScheduler({ mode: 'cloudflare' }) as CloudflareSchedulerAdapter;
    }
    return _scheduler;
}

// ── Register scheduled jobs ─────────────────────────────────────────────
//
// await getScheduler().then((s) => {
//     s.register({
//         name: 'daily-cleanup',
//         schedule: '0 0 * * *', // midnight UTC
//         handler: async (scheduledTime, cron) => {
//             // your logic here
//         },
//     });
// });

// ── Cloudflare Cron Trigger handler ─────────────────────────────────────
// Exported as a named export and re-exported from index.ts via:
//   export { scheduled } from './scheduled';
//
// The Cloudflare Workers runtime calls scheduled(event, env, ctx) for each
// cron trigger defined in wrangler.toml [[triggers]].

export async function scheduled(
    event: ScheduledEvent,
    _env: Record<string, unknown>,
    ctx: ExecutionContext,
): Promise<void> {
    const scheduler = await getScheduler();
    const job = scheduler.getJobByCron(event.cron);

    if (!job) {
        logger.warn('No registered job for cron expression', { cron: event.cron });
        return;
    }

    ctx.waitUntil(
        job.handler(event.scheduledTime, event.cron).catch((error) => {
            logger.error('Scheduled job failed', {
                jobName: job.name,
                error: error instanceof Error ? error.message : String(error),
            });
        }),
    );
}
