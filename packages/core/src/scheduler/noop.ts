import type { ScheduledJob, SchedulerAdapter } from './types';

/**
 * No-Op Scheduler Adapter for environments without scheduling support.
 *
 * Tracks registered job names for introspection but never executes them.
 * Used when the scheduler is disabled or not needed (e.g. dev, tests, or
 * stateless deployments).
 */
export class NoOpSchedulerAdapter implements SchedulerAdapter {
    private jobNames: string[] = [];

    constructor() {
        // registry initialized via field initializer
    }

    register(job: ScheduledJob): void {
        this.jobNames.push(job.name);
    }

    async start(): Promise<void> {
        void 0; // No-op: jobs are registered but not executed
    }

    async stop(): Promise<void> {
        void 0; // No-op
    }

    getJobs(): string[] {
        return [...this.jobNames];
    }
}
