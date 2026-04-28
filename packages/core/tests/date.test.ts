import { describe, expect, it } from 'bun:test';
import { fromMs, nowMs, toMs } from '../src/date';

describe('nowMs', () => {
    it('returns a positive number', () => {
        expect(nowMs()).toBeGreaterThan(0);
    });

    it('returns a value close to Date.now()', () => {
        const before = Date.now();
        const result = nowMs();
        const after = Date.now();
        expect(result).toBeGreaterThanOrEqual(before);
        expect(result).toBeLessThanOrEqual(after);
    });
});

describe('toMs', () => {
    it('converts Date to ms', () => {
        const date = new Date('2024-06-15T12:00:00Z');
        expect(toMs(date)).toBe(date.getTime());
    });

    it('passes through a number unchanged', () => {
        expect(toMs(1718452800000)).toBe(1718452800000);
    });

    it('floors float numbers', () => {
        expect(toMs(1718452800000.7)).toBe(1718452800000);
    });

    it('converts ISO string to ms', () => {
        const result = toMs('2024-06-15T12:00:00Z');
        expect(result).toBe(new Date('2024-06-15T12:00:00Z').getTime());
    });

    it('returns null for invalid string', () => {
        expect(toMs('not-a-date')).toBeNull();
    });

    it('returns null for null input', () => {
        expect(toMs(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(toMs(undefined)).toBeNull();
    });
});

describe('fromMs', () => {
    it('converts ms to Date', () => {
        const date = fromMs(1718452800000);
        expect(date).toBeInstanceOf(Date);
        if (!date) throw new Error('expected date');
        expect(date.getTime()).toBe(1718452800000);
    });

    it('returns null for null input', () => {
        expect(fromMs(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(fromMs(undefined)).toBeNull();
    });

    it('returns null for NaN input', () => {
        expect(fromMs(NaN)).toBeNull();
    });
});
