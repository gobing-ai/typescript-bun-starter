import { integer } from 'drizzle-orm/sqlite-core';

/**
 * Returns the current date.
 * Extracted for testability and V8 coverage tracking.
 */
export function nowTimestamp(): Date {
    return new Date();
}

/**
 * Standard columns shared across all entity tables.
 *
 * Usage in schema definitions:
 * ```ts
 * import { standardColumns } from './columns';
 *
 * export const myTable = sqliteTable('my_table', {
 *     id: text('id').primaryKey(),
 *     name: text('name').notNull(),
 *     ...standardColumns,
 * });
 * ```
 */
export function buildStandardColumns() {
    return {
        createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowTimestamp),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowTimestamp),
    };
}

export const standardColumns = buildStandardColumns();

/**
 * Standard columns with soft-delete support.
 *
 * Adds an `inUsed` column (1 = active, 0 = soft-deleted).
 * EntityDao automatically filters by `inUsed = 1` when the table has this column.
 */
export function buildStandardColumnsWithSoftDelete() {
    return {
        ...buildStandardColumns(),
        inUsed: integer('in_used').notNull().default(1),
    };
}

export const standardColumnsWithSoftDelete = buildStandardColumnsWithSoftDelete();

/**
 * Type helper for tables that use standard columns.
 * Provides the `inUsed`, `updatedAt`, `createdAt` column types.
 */
export type StandardColumns = typeof standardColumns;

/**
 * Type helper for tables that use standard columns with soft delete.
 */
export type StandardColumnsWithSoftDelete = typeof standardColumnsWithSoftDelete;
