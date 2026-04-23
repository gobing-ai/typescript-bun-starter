import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureLogger, createLoggerSinks, getLogger, getLoggerConfig, resetLogger } from '../src/logging';

afterEach(() => {
    resetLogger();
});

describe('getLoggerConfig', () => {
    test('uses file-only logging in test environment by default', () => {
        const config = getLoggerConfig({ NODE_ENV: 'test' });

        expect(config.console).toBe(false);
        expect(config.file).toBe(true);
        expect(config.loggers[0]).toEqual({
            category: 'magnifier',
            lowestLevel: 'info',
            sinks: ['file'],
        });
    });

    test('enables both console and file sinks outside tests by default', () => {
        const config = getLoggerConfig({ NODE_ENV: 'development' });

        expect(config.console).toBe(true);
        expect(config.file).toBe(true);
        expect(config.loggers[0]).toEqual({
            category: 'magnifier',
            lowestLevel: 'info',
            sinks: ['console', 'file'],
        });
    });

    test('honors LOG_LEVEL normalization for warn', () => {
        const config = getLoggerConfig({ NODE_ENV: 'development', LOG_LEVEL: 'warn' });

        expect(config.loggers[0]?.lowestLevel).toBe('warning');
    });

    test('accepts all explicit log levels and environment toggles', () => {
        const levels = ['trace', 'debug', 'info', 'error', 'fatal'] as const;

        for (const level of levels) {
            const config = getLoggerConfig({
                NODE_ENV: 'development',
                LOG_LEVEL: level,
                LOG_TO_CONSOLE: '0',
                LOG_TO_FILE: '0',
                LOG_JSON: '1',
                LOG_FILE_PATH: `logs/${level}.log`,
            });

            expect(config.console).toBe(false);
            expect(config.file).toBe(false);
            expect(config.json).toBe(true);
            expect(config.filePath).toBe(`logs/${level}.log`);
            expect(config.loggers[0]?.lowestLevel).toBe(level);
            expect(config.loggers[0]?.sinks).toEqual([]);
        }
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

describe('getLogger', () => {
    test('prefixes custom categories with magnifier root', () => {
        const child = getLogger('analytics:cost');

        expect(child.category).toEqual(['magnifier', 'analytics', 'cost']);
    });

    test('does not double-prefix root category', () => {
        const child = getLogger('magnifier:core');

        expect(child.category).toEqual(['magnifier', 'core']);
    });

    test('falls back to the root category for empty category segments', () => {
        const child = getLogger('::');

        expect(child.category).toEqual(['magnifier']);
    });
});

describe('createLoggerSinks', () => {
    test('builds default console and file sinks', () => {
        const logDir = mkdtempSync(join(tmpdir(), 'logging-sinks-'));
        const sinks = createLoggerSinks({
            console: true,
            file: true,
            filePath: join(logDir, 'nested', 'app.log'),
            json: false,
        });

        expect(Object.keys(sinks).sort()).toEqual(['console', 'file']);
    });
});

describe('configureLogger', () => {
    test('returns early when already configured with default options', () => {
        configureLogger({
            console: false,
            file: false,
        });

        expect(() => configureLogger()).not.toThrow();
    });
});
