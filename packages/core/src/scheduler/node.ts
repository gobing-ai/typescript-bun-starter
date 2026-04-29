import { logger } from '../logger';
import type { ScheduledJob, SchedulerAdapter } from './types';

type ScheduledTask = { stop(): void };

type NodeCron = {
    validate(expression: string): boolean;
    schedule(expression: string, func: () => void | Promise<void>, options?: { timezone?: string }): ScheduledTask;
};

/**
 * Node.js Scheduler Adapter using node-cron.
 *
 * Runs scheduled jobs in-process via dynamic import of node-cron. The dynamic
 * import keeps node-cron out of Cloudflare Workers bundles. Suitable for VPS
 * and local development.
 */
export class NodeSchedulerAdapter implements SchedulerAdapter {
    private jobs = new Map<string, { definition: ScheduledJob; task: ScheduledTask | null }>();
    private cron: NodeCron | null = null;

    constructor() {
        // initialized via field initializers
    }

    register(job: ScheduledJob): void {
        if (this.jobs.has(job.name)) {
            throw new Error(`Job with name "${job.name}" is already registered`);
        }

        this.jobs.set(job.name, { definition: job, task: null });
    }

    async start(): Promise<void> {
        if (!this.cron) {
            try {
                const cronModule = await import('node-cron');
                this.cron = cronModule.default as unknown as NodeCron;
            } catch (error) {
                logger.error('Failed to load node-cron module', {
                    error: error instanceof Error ? error.message : String(error),
                });
                throw new Error('node-cron is required for NodeSchedulerAdapter but failed to load');
            }
        }

        for (const [name, { definition, task }] of this.jobs.entries()) {
            if (task) {
                logger.warn('Job already started, skipping', { jobName: name });
                continue;
            }

            if (!this.cron.validate(definition.schedule)) {
                throw new Error(`Invalid cron expression "${definition.schedule}" for job "${name}"`);
            }

            const cronTask = this.cron.schedule(
                definition.schedule,
                async () => {
                    const scheduledTime = Date.now();
                    logger.info('Executing scheduled job', {
                        jobName: name,
                        schedule: definition.schedule,
                        scheduledTime,
                    });

                    try {
                        await definition.handler(scheduledTime, definition.schedule);
                        logger.info('Scheduled job completed', { jobName: name });
                    } catch (error) {
                        logger.error('Scheduled job failed', {
                            error: error instanceof Error ? error.message : String(error),
                            jobName: name,
                        });
                    }
                },
                { timezone: definition.timezone ?? 'UTC' },
            );

            const jobEntry = this.jobs.get(name);
            if (jobEntry) {
                jobEntry.task = cronTask;
            }

            logger.info('Scheduled job started', {
                jobName: name,
                schedule: definition.schedule,
                timezone: definition.timezone ?? 'UTC',
            });
        }

        logger.info('Node.js scheduler started', {
            jobCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys()),
        });
    }

    async stop(): Promise<void> {
        for (const [name, { task }] of this.jobs.entries()) {
            if (task) {
                task.stop();
                logger.info('Stopped scheduled job', { jobName: name });
            }
        }

        logger.info('Node.js scheduler stopped');
    }

    getJobs(): string[] {
        return Array.from(this.jobs.keys());
    }

    isJobRunning(name: string): boolean {
        const jobEntry = this.jobs.get(name);
        return jobEntry?.task !== null && jobEntry?.task !== undefined;
    }
}
