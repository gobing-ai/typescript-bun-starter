import { describe, expect, test } from 'bun:test';
import { getLoggerConfig } from '../src/logging';

describe('getLoggerConfig', () => {
    test('disables application sinks in test environment', () => {
        const config = getLoggerConfig({ NODE_ENV: 'test' });

        expect(config.loggers[0]).toEqual({
            category: 'tbs',
            lowestLevel: 'info',
            sinks: [],
        });
    });

    test('keeps console sink enabled outside tests', () => {
        const config = getLoggerConfig({ NODE_ENV: 'development' });

        expect(config.loggers[0]).toEqual({
            category: 'tbs',
            lowestLevel: 'info',
            sinks: ['console'],
        });
    });

    test('always suppresses logtape meta logs', () => {
        const config = getLoggerConfig({ NODE_ENV: 'production' });

        expect(config.loggers[1]).toEqual({
            category: ['logtape', 'meta'],
            lowestLevel: 'warning',
            sinks: [],
        });
    });
});
