import { describe, expect, test } from 'bun:test';
import {
    buildStandardColumns,
    buildStandardColumnsWithSoftDelete,
    nowTimestamp,
    standardColumns,
    standardColumnsWithSoftDelete,
} from '../../../src/db/schema/common';

describe('schema/common.ts', () => {
    describe('nowTimestamp', () => {
        test('returns a number', () => {
            expect(nowTimestamp()).toBeNumber();
        });

        test('returns ms-precision timestamp', () => {
            const before = Date.now();
            const ts = nowTimestamp();
            const after = Date.now();
            expect(ts).toBeGreaterThanOrEqual(before);
            expect(ts).toBeLessThanOrEqual(after);
        });
    });

    describe('buildStandardColumns', () => {
        test('returns object with createdAt and updatedAt', () => {
            const cols = buildStandardColumns();
            expect(cols.createdAt).toBeDefined();
            expect(cols.updatedAt).toBeDefined();
        });

        test('returns a fresh object each call', () => {
            expect(buildStandardColumns()).not.toBe(buildStandardColumns());
        });
    });

    describe('standardColumns', () => {
        test('has createdAt and updatedAt columns', () => {
            expect(standardColumns.createdAt).toBeDefined();
            expect(standardColumns.updatedAt).toBeDefined();
        });
    });

    describe('buildStandardColumnsWithSoftDelete', () => {
        test('returns object with three columns', () => {
            const cols = buildStandardColumnsWithSoftDelete();
            expect(cols.createdAt).toBeDefined();
            expect(cols.updatedAt).toBeDefined();
            expect(cols.inUsed).toBeDefined();
        });
    });

    describe('standardColumnsWithSoftDelete', () => {
        test('includes all three columns', () => {
            expect(standardColumnsWithSoftDelete.createdAt).toBeDefined();
            expect(standardColumnsWithSoftDelete.updatedAt).toBeDefined();
            expect(standardColumnsWithSoftDelete.inUsed).toBeDefined();
        });
    });
});
