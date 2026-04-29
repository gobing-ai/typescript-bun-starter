/**
 * Scheduler abstraction for cross-environment cron job scheduling.
 *
 * - Cloudflare Workers: Cron triggers defined in wrangler.toml; adapter acts as registry.
 * - VPS / local: In-process scheduling via dynamic import of node-cron.
 * - NoOp: Tracking-only, never executes (dev/test/disabled).
 */

export type ScheduledJobHandler = (scheduledTime: number, cronExpression: string) => Promise<void>;

export interface ScheduledJob {
    name: string;
    /** Cron expression (e.g. "0 0 * * *" for daily at midnight) */
    schedule: string;
    handler: ScheduledJobHandler;
    /** Timezone, defaults to UTC */
    timezone?: string;
}

export interface SchedulerAdapter {
    register(job: ScheduledJob): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    getJobs(): string[];
}
