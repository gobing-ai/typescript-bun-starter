import { nowMs } from '../date';
import { getDbOperationDuration, getDbOperationErrors, getDbOperationTotal } from '../telemetry/metrics';
import { traceAsync } from '../telemetry/tracing';
import type { DbClient } from './adapter';
import { runWithDbSpan } from './span-context';

/**
 * DB span naming convention: `db.{collection}.{operation}`
 *
 * Examples:
 * - `db.skills.insert`
 * - `db.skills.select`
 * - `db.skills.update`
 * - `db.skills.delete`
 */
function buildDbSpanName(collection: string, operation: string): string {
    return `db.${collection}.${operation}`;
}

export abstract class BaseDao {
    protected constructor(protected readonly db: DbClient) {}

    protected now(): number {
        return nowMs();
    }

    /**
     * Run a DB operation with baseline metrics and tracing instrumentation.
     *
     * Records operation count, duration, errors, and a trace span on the
     * configured meter and tracer providers. When telemetry is disabled,
     * all operations degrade to no-ops.
     *
     * Span naming follows the convention: `db.{collection}.{operation}`
     *
     * @param operation - Logical operation name (e.g. `'insert'`, `'select'`).
     * @param collection - Logical table/collection name (e.g. `'skills'`).
     * @param fn - The DB operation to execute.
     */
    protected async withMetrics<T>(operation: string, collection: string, fn: () => Promise<T>): Promise<T> {
        const startTime = performance.now();
        const attrs = {
            'db.operation': operation,
            'db.collection': collection,
            'db.system': 'sqlite',
        };
        const spanName = buildDbSpanName(collection, operation);
        let errorType: string | undefined;

        try {
            const result = await traceAsync(spanName, async (span) => {
                span.setAttributes(attrs);
                return await runWithDbSpan(span, fn);
            });
            return result;
        } catch (error) {
            errorType = error instanceof Error ? error.name : 'Unknown';
            getDbOperationErrors().add(1, {
                ...attrs,
                'error.type': errorType,
            });
            throw error;
        } finally {
            getDbOperationTotal().add(1, attrs);
            getDbOperationDuration().record(performance.now() - startTime, {
                ...attrs,
                ...(errorType !== undefined ? { 'error.type': errorType } : {}),
            });
        }
    }
}
