import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Logger } from '@logtape/logtape';
import { getLogger, logger, reset, withContext } from '../src/logger';

afterEach(() => {
    reset();
});

describe('logger', () => {
    test('exposes the standard log methods', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });

    test('resolves to the magnifier root logger', () => {
        expect(logger.category).toEqual(['magnifier']);
    });

    test('supports method reassignment for tests', () => {
        const infoSpy = mock(() => {});

        logger.info = infoSpy as unknown as typeof logger.info;
        logger.info('hello');

        expect(infoSpy).toHaveBeenCalledWith('hello');
    });

    test('reset clears mocked methods', () => {
        const infoSpy = mock(() => {});

        logger.info = infoSpy as unknown as typeof logger.info;
        reset();
        logger.info('after-reset');

        expect(infoSpy).not.toHaveBeenCalledWith('after-reset');
    });
});

describe('withContext', () => {
    test('creates a child logger with pkg and op segments', () => {
        const child = withContext('etl-claude', 'parse');

        expect(child.category).toEqual(['magnifier', 'etl-claude', 'parse']);
    });

    test('accepts a pre-segmented pkg value', () => {
        const child = withContext('analytics:cost');

        expect(child.category).toEqual(['magnifier', 'analytics', 'cost']);
    });

    test('works without op', () => {
        const child = withContext('service');

        expect(child.category).toEqual(['magnifier', 'service']);
    });
});

describe('getLogger export', () => {
    test('returns a LogTape logger instance', () => {
        const instance: Logger = getLogger('worker:process');

        expect(instance.category).toEqual(['magnifier', 'worker', 'process']);
        expect(typeof instance.info).toBe('function');
    });
});
