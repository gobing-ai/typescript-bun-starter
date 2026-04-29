import { logger } from '../logger';
import type { ScheduledJob, ScheduledJobHandler, SchedulerAdapter } from './types';

/**
 * Cloudflare Scheduler Adapter.
 *
 * Cron triggers are defined in wrangler.toml and dispatched via the `scheduled`
 * event handler. This adapter serves as a registry — it stores job definitions
 * and provides lookup methods for the scheduled handler to find and invoke the
 * correct job at runtime.
 */
export class CloudflareSchedulerAdapter implements SchedulerAdapter {
    private jobs = new Map<string, ScheduledJob>();

    constructor() {
        // registry initialized via field initializer
    }

    register(job: ScheduledJob): void {
        if (this.jobs.has(job.name)) {
            throw new Error(`Job with name "${job.name}" is already registered`);
        }
        this.jobs.set(job.name, job);
    }

    async start(): Promise<void> {
        logger.info('Cloudflare scheduler ready', {
            jobCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys()),
        });
    }

    async stop(): Promise<void> {
        logger.info('Cloudflare scheduler stopped');
    }

    getJobs(): string[] {
        return Array.from(this.jobs.keys());
    }

    /**
     * Get a job handler by name.
     * Used by the scheduled event handler to invoke the correct job.
     */
    getJobHandler(name: string): ScheduledJobHandler | undefined {
        return this.jobs.get(name)?.handler;
    }

    /**
     * Find a job by its cron expression.
     * Useful when the Cloudflare event provides a cron expression but not a job name.
     */
    getJobByCron(cronExpression: string): ScheduledJob | undefined {
        for (const job of this.jobs.values()) {
            if (job.schedule === cronExpression) {
                return job;
            }
        }
        return undefined;
    }
}
