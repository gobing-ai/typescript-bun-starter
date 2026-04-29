import { nowMs } from '../date';
import type { DbClient } from '../db/adapter';
import { eq, or, sql } from '../db/query-helpers';
import { queueJobs } from '../db/schema';
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
    private readonly db: DbClient;
    private readonly config: Required<QueueConsumerConfig>;
    private readonly handlers = new Map<string, JobHandler>();
    private _stopped = false;
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _inFlight = 0;

    constructor(db: DbClient, config: QueueConsumerConfig = {}) {
        this.db = db;
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
        const countByStatus = async (status: string): Promise<number> => {
            const rows = await this.db.select().from(queueJobs).where(sql`${queueJobs.status} = ${status}`);
            return rows.length;
        };

        const [pending, processing, completed, failed] = await Promise.all([
            countByStatus('pending'),
            countByStatus('processing'),
            countByStatus('completed'),
            countByStatus('failed'),
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
        const cutoff = nowMs() - this.config.visibilityTimeout;

        const stuck = await this.db
            .update(queueJobs)
            .set({
                status: 'pending',
                processingAt: null,
                updatedAt: nowMs(),
            })
            .where(
                sql`${queueJobs.status} = 'processing' AND ${queueJobs.processingAt} IS NOT NULL AND ${queueJobs.processingAt} <= ${cutoff}`,
            );

        if (stuck.changes > 0) {
            logger.warn('Reset stuck processing jobs', { count: stuck.changes });
        }
    }

    // ── Batch processing ─────────────────────────────────────────────────

    private async processBatch(): Promise<void> {
        const now = nowMs();

        // Fetch pending jobs that are ready (nextRetryAt <= now)
        const pending = await this.db
            .select()
            .from(queueJobs)
            .where(
                or(
                    sql`${queueJobs.status} = 'pending' AND ${queueJobs.nextRetryAt} IS NULL`,
                    sql`${queueJobs.status} = 'pending' AND ${queueJobs.nextRetryAt} <= ${now}`,
                ),
            )
            .orderBy(queueJobs.createdAt)
            .limit(this.config.batchSize);

        if (pending.length === 0) return;

        // Mark as processing
        const ids = pending.map((j) => j.id);
        await this.db
            .update(queueJobs)
            .set({
                status: 'processing',
                processingAt: now,
                updatedAt: now,
            })
            .where(sql`${queueJobs.id} IN (${ids.join(', ')})`);

        // Process each job
        for (const row of pending) {
            this._inFlight++;
            void this.processJob(row).finally(() => {
                this._inFlight--;
            });
        }
    }

    // ── Single job processing ────────────────────────────────────────────

    private async processJob(row: typeof queueJobs.$inferSelect): Promise<void> {
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
            await this.completeJob(row.id);
            logger.debug('Job completed', { jobId: row.id, type: row.type });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Job failed', { jobId: row.id, type: row.type, error: message });
            await this.retryOrFailJob(row, message);
        }
    }

    // ── Job state transitions ────────────────────────────────────────────

    private async completeJob(id: string): Promise<void> {
        await this.db
            .update(queueJobs)
            .set({
                status: 'completed',
                updatedAt: nowMs(),
                processingAt: null,
            })
            .where(eq(queueJobs.id, id));
    }

    private async failJob(row: typeof queueJobs.$inferSelect, error: Error): Promise<void> {
        await this.db
            .update(queueJobs)
            .set({
                status: 'failed',
                attempts: row.attempts,
                lastError: error.message,
                updatedAt: nowMs(),
                processingAt: null,
            })
            .where(eq(queueJobs.id, row.id));
    }

    private async retryOrFailJob(row: typeof queueJobs.$inferSelect, errorMessage: string): Promise<void> {
        const attempts = row.attempts + 1;

        if (attempts >= row.maxRetries) {
            await this.db
                .update(queueJobs)
                .set({
                    status: 'failed',
                    attempts,
                    lastError: errorMessage,
                    updatedAt: nowMs(),
                    processingAt: null,
                })
                .where(eq(queueJobs.id, row.id));
            return;
        }

        const nextRetryAt = nowMs() + this.calculateBackoff(attempts);

        await this.db
            .update(queueJobs)
            .set({
                status: 'pending',
                attempts,
                lastError: errorMessage,
                nextRetryAt,
                updatedAt: nowMs(),
                processingAt: null,
            })
            .where(eq(queueJobs.id, row.id));
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
