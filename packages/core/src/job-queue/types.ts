/**
 * Job queue types for async work processing with retry.
 *
 * Generic over a payload type so callers define their own job shapes.
 * The DB-backed implementations serialize payload to JSON text.
 */

export interface Job<T = unknown> {
    id: string;
    type: string;
    payload: T;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    maxRetries: number;
    createdAt: number;
    updatedAt: number;
    nextRetryAt: number | null;
    lastError: string | null;
    processingAt: number | null;
}

export interface EnqueueOptions {
    /** Max retry attempts. Default 3. */
    maxRetries?: number;
    /** Delay before first processing attempt in ms. Default 0 (immediate). */
    delay?: number;
}

export interface JobQueue<T = unknown> {
    enqueue(type: string, payload: T, options?: EnqueueOptions): Promise<string>;
    enqueueBatch(jobs: Array<{ type: string; payload: T } & EnqueueOptions>): Promise<string[]>;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

export interface QueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}

export interface QueueConsumerConfig {
    /** Interval between poll cycles in ms. Default 5000. */
    pollInterval?: number;
    /** Max jobs fetched per poll. Default 10. */
    batchSize?: number;
    /** If a job has been processing longer than this (ms), reset to pending. Default 30000. */
    visibilityTimeout?: number;
    /** Base delay for exponential backoff in ms. Default 1000. */
    baseDelay?: number;
    /** Max delay for exponential backoff in ms. Default 60000. */
    maxDelay?: number;
}

export interface QueueConsumer<T = unknown> {
    /** Register a handler for a job type. */
    register(type: string, handler: JobHandler<T>): void;
    /** Start the polling loop. */
    start(): Promise<void>;
    /** Graceful stop — drains in-flight jobs up to a deadline. */
    stop(): Promise<void>;
    /** Current queue statistics. */
    stats(): Promise<QueueStats>;
}
