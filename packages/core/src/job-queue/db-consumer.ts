import { nowMs } from '../date';
import type { DbClient } from '../db/adapter';
import { QueueJobDao, type QueueJobRecord } from '../db/queue-job-dao';
import { logger } from '../logger';
import type { Job, JobHandler, QueueConsumer, QueueConsumerConfig, QueueStats } from './types';

const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_VISIBILITY_TIMEOUT = 30000;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 60000;

/**
 * DB-backed polling queue consumer with retry and exponential backoff.
 *
 * Polls the `queue_jobs` table at configurable intervals, fetches pending
 * jobs in batches, and dispatches them to registered type handlers.
 *
 * Retry strategy:
 *   delay = min(baseDelay * 2^attempt, maxDelay) ± 25% jitter
 *
 * Stuck jobs (processing beyond visibilityTimeout) are reset to pending
 * on each poll cycle so another consumer can pick them up.
 */
export class DBQueueConsumer implements QueueConsumer {
    private readonly dao: QueueJobDao;
    private readonly config: Required<QueueConsumerConfig>;
    private readonly handlers = new Map<string, JobHandler>();
    private _stopped = false;
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _inFlight = 0;

    constructor(db: DbClient, config: QueueConsumerConfig = {}) {
        this.dao = new QueueJobDao(db);
        this.config = {
            pollInterval: config.pollInterval ?? DEFAULT_POLL_INTERVAL,
            batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
            visibilityTimeout: config.visibilityTimeout ?? DEFAULT_VISIBILITY_TIMEOUT,
            baseDelay: config.baseDelay ?? DEFAULT_BASE_DELAY,
            maxDelay: config.maxDelay ?? DEFAULT_MAX_DELAY,
        };
    }

    // ── QueueConsumer interface ──────────────────────────────────────────

    register(type: string, handler: JobHandler): void {
        if (this.handlers.has(type)) {
            throw new Error(`Handler already registered for job type "${type}"`);
        }
        this.handlers.set(type, handler);
    }

    async start(): Promise<void> {
        this._stopped = false;
        logger.info('Queue consumer started', {
            pollInterval: this.config.pollInterval,
            batchSize: this.config.batchSize,
        });
        this.scheduleNextPoll();
    }

    async stop(): Promise<void> {
        this._stopped = true;

        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        logger.info('Queue consumer stopping, waiting for in-flight jobs', {
            inFlight: this._inFlight,
        });

        const deadline = nowMs() + 30000;
        while (this._inFlight > 0 && nowMs() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (this._inFlight > 0) {
            logger.warn('Queue consumer stopped with jobs still in-flight', {
                inFlight: this._inFlight,
            });
        } else {
            logger.info('Queue consumer stopped');
        }
    }

    async stats(): Promise<QueueStats> {
        const [pending, processing, completed, failed] = await Promise.all([
            this.dao.countByStatus('pending'),
            this.dao.countByStatus('processing'),
            this.dao.countByStatus('completed'),
            this.dao.countByStatus('failed'),
        ]);

        return { pending, processing, completed, failed };
    }

    // ── Polling loop ─────────────────────────────────────────────────────

    private scheduleNextPoll(): void {
        if (this._stopped) return;
        this._timer = setTimeout(() => {
            void this.poll();
        }, this.config.pollInterval);
    }

    private async poll(): Promise<void> {
        if (this._stopped) return;

        try {
            await this.resetStuckJobs();
            await this.processBatch();
        } catch (error) {
            logger.error('Queue consumer poll error', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        this.scheduleNextPoll();
    }

    // ── Stuck job recovery ───────────────────────────────────────────────

    private async resetStuckJobs(): Promise<void> {
        const count = await this.dao.resetStuckJobs(this.config.visibilityTimeout);

        if (count > 0) {
            logger.warn('Reset stuck processing jobs', { count });
        }
    }

    // ── Batch processing ─────────────────────────────────────────────────

    private async processBatch(): Promise<void> {
        const pending = await this.dao.findPending(this.config.batchSize);

        if (pending.length === 0) return;

        // Mark as processing
        const ids = pending.map((j) => j.id);
        await this.dao.markProcessing(ids);

        // Process each job
        for (const row of pending) {
            this._inFlight++;
            void this.processJob(row).finally(() => {
                this._inFlight--;
            });
        }
    }

    // ── Single job processing ────────────────────────────────────────────

    private async processJob(row: QueueJobRecord): Promise<void> {
        const handler = this.handlers.get(row.type);

        if (!handler) {
            logger.warn('No handler registered for job type', { type: row.type, jobId: row.id });
            await this.failJob(row, new Error(`No handler registered for type "${row.type}"`));
            return;
        }

        const job: Job = {
            id: row.id,
            type: row.type,
            payload: this.parsePayload(row.payload),
            status: row.status as Job['status'],
            attempts: row.attempts,
            maxRetries: row.maxRetries,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            nextRetryAt: row.nextRetryAt,
            lastError: row.lastError,
            processingAt: row.processingAt,
        };

        try {
            await handler(job);
            await this.dao.markCompleted(row.id);
            logger.debug('Job completed', { jobId: row.id, type: row.type });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Job failed', { jobId: row.id, type: row.type, error: message });
            await this.retryOrFailJob(row, message);
        }
    }

    // ── Job state transitions ────────────────────────────────────────────

    private async failJob(row: QueueJobRecord, error: Error): Promise<void> {
        await this.dao.markFailed(row.id, row.attempts, error.message);
    }

    private async retryOrFailJob(row: QueueJobRecord, errorMessage: string): Promise<void> {
        const attempts = row.attempts + 1;

        if (attempts >= row.maxRetries) {
            await this.dao.markFailed(row.id, attempts, errorMessage);
            return;
        }

        const nextRetryAt = nowMs() + this.calculateBackoff(attempts);
        await this.dao.markForRetry(row.id, attempts, errorMessage, nextRetryAt);
    }

    // ── Backoff ──────────────────────────────────────────────────────────

    private calculateBackoff(attempt: number): number {
        const delay = Math.min(this.config.baseDelay * 2 ** attempt, this.config.maxDelay);
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        return Math.round(delay + jitter);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private parsePayload(raw: string): unknown {
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }
}
