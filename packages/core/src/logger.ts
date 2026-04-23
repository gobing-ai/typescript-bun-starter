import type { Logger } from '@logtape/logtape';

import { configureLogger, getLogger as createLogger, resetLogger as resetLogging } from './logging';

export type { LogEntry, LoggerOptions, LogLevel } from './logging';
export { configureLogger, getLoggerConfig, resetLogger } from './logging';
export { createLogger as getLogger };

let defaultLogger: Logger | null = null;
const mockedProps: Partial<Record<keyof Logger, Logger[keyof Logger]>> = {};

function getDefaultLogger(): Logger {
    if (!defaultLogger) {
        configureLogger();
        defaultLogger = createLogger();
    }

    return defaultLogger;
}

export const logger: Logger = new Proxy({} as Logger, {
    get(_target, prop) {
        if (prop in mockedProps) {
            return mockedProps[prop as keyof Logger];
        }

        const targetLogger = getDefaultLogger();
        const value = targetLogger[prop as keyof Logger];

        if (typeof value === 'function') {
            return value.bind(targetLogger);
        }

        return value;
    },
    set(_target, prop, value) {
        mockedProps[prop as keyof Logger] = value;
        return true;
    },
});

export function withContext(pkg: string, op?: string): Logger {
    const category = op ? `${pkg}:${op}` : pkg;
    return createLogger(category);
}

export function reset(): void {
    defaultLogger = null;

    for (const key of Object.keys(mockedProps) as Array<keyof Logger>) {
        delete mockedProps[key];
    }

    resetLogging();
}
