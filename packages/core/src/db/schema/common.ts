import { integer } from 'drizzle-orm/sqlite-core';
import { nowMs } from '../../date';

/**
 * Returns the current timestamp in milliseconds.
 * Extracted for testability and V8 coverage tracking.
 */
export function nowTimestamp(): number {
    return nowMs();
}

/**
 * Standard columns shared across all entity tables.
 *
 * Uses plain `integer` (returns `number`) to match the existing codebase
 * convention where `nowMs()` returns `number` and all timestamp comparisons
 * use numeric operators.
 *
 * Usage in schema definitions:
 * ```ts
 * import { standardColumns } from './common';
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
        createdAt: integer('created_at').notNull().$defaultFn(nowTimestamp),
        updatedAt: integer('updated_at').notNull().$defaultFn(nowTimestamp),
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
