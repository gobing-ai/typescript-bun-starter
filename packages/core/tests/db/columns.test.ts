import { describe, expect, test } from 'bun:test';
import {
    buildStandardColumns,
    buildStandardColumnsWithSoftDelete,
    nowTimestamp,
    standardColumns,
    standardColumnsWithSoftDelete,
} from '../../src';

describe('columns', () => {
    test('nowTimestamp returns a number', () => {
        expect(nowTimestamp()).toBeNumber();
    });

    test('buildStandardColumns returns createdAt and updatedAt', () => {
        const cols = buildStandardColumns();
        expect(cols.createdAt).toBeDefined();
        expect(cols.updatedAt).toBeDefined();
    });

    test('buildStandardColumnsWithSoftDelete includes inUsed', () => {
        const cols = buildStandardColumnsWithSoftDelete();
        expect(cols.inUsed).toBeDefined();
        expect(cols.createdAt).toBeDefined();
        expect(cols.updatedAt).toBeDefined();
    });

    test('standardColumns has createdAt and updatedAt', () => {
        expect(standardColumns.createdAt).toBeDefined();
        expect(standardColumns.updatedAt).toBeDefined();
    });

    test('standardColumnsWithSoftDelete has inUsed column', () => {
        expect(standardColumnsWithSoftDelete.inUsed).toBeDefined();
        expect(standardColumnsWithSoftDelete.createdAt).toBeDefined();
        expect(standardColumnsWithSoftDelete.updatedAt).toBeDefined();
    });
});
