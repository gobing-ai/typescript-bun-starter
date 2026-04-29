import { logger } from '../logger';
import { CloudflareSchedulerAdapter } from './cloudflare';
import { NodeSchedulerAdapter } from './node';
import { NoOpSchedulerAdapter } from './noop';
import type { SchedulerAdapter } from './types';

export interface SchedulerOptions {
    /** Override SCHEDULER_ENABLED env var. Default true. */
    enabled?: boolean;
    /** Override APP_MODE env var. Default 'node'. */
    mode?: 'cloudflare' | 'node';
}

/**
 * Create a scheduler adapter based on environment.
 *
 * Selection logic:
 * 1. If `SCHEDULER_ENABLED=false`, returns NoOpSchedulerAdapter
 * 2. If `APP_MODE=cloudflare`, returns CloudflareSchedulerAdapter (registry only)
 * 3. Otherwise, returns NodeSchedulerAdapter (in-process node-cron)
 *
 * @param options - Optional overrides for testing or explicit control
 */
export function initScheduler(options?: SchedulerOptions): SchedulerAdapter {
    const enabled = options?.enabled ?? process.env.SCHEDULER_ENABLED !== 'false';
    if (!enabled) {
        logger.info('Scheduler is disabled');
        return new NoOpSchedulerAdapter();
    }

    const mode = options?.mode ?? (process.env.APP_MODE as string | undefined) ?? 'node';

    switch (mode) {
        case 'cloudflare':
            logger.info('Initializing Cloudflare scheduler adapter');
            return new CloudflareSchedulerAdapter();

        default: {
            const fallbackMode = mode !== 'node' ? mode : undefined;
            if (fallbackMode) {
                logger.warn('Unknown APP_MODE, falling back to Node.js scheduler', { appMode: mode });
            } else {
                logger.info('Initializing Node.js scheduler adapter');
            }
            return new NodeSchedulerAdapter();
        }
    }
}
