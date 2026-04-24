import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
    configureSync,
    getConsoleSink,
    getJsonLinesFormatter,
    getLogger as getLogtapeLogger,
    getTextFormatter,
    type Logger,
    type LogRecord,
    type LoggerConfig as LogtapeLoggerConfig,
    type LogLevel as LogtapeLogLevel,
    resetSync,
    type Sink,
} from '@logtape/logtape';

const ROOT_CATEGORY = 'magnifier';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
    level: LogLevel;
    category: string;
    message: string;
    properties?: Record<string, unknown>;
}

export interface LoggerOptions {
    level?: LogLevel;
    console?: boolean;
    file?: boolean;
    filePath?: string;
    json?: boolean;
    category?: string;
}

type Environment = Record<string, string | undefined>;

interface ResolvedLoggerConfig {
    level: LogtapeLogLevel;
    console: boolean;
    file: boolean;
    filePath: string;
    json: boolean;
    category: string;
}

interface LoggerConfigResult {
    console: boolean;
    file: boolean;
    filePath: string;
    json: boolean;
    loggers: [LogtapeLoggerConfig<string, string>, LogtapeLoggerConfig<string, string>];
}

let configured = false;
let resolvedConfig: ResolvedLoggerConfig | null = null;
let fileStream: NodeJS.WritableStream | null = null;

function parseBooleanEnv(value: string | undefined): boolean | undefined {
    if (value === undefined) {
        return undefined;
    }

    return value === '1';
}

function normalizeLevel(level: string | undefined): LogtapeLogLevel | undefined {
    switch (level) {
        case 'trace':
        case 'debug':
        case 'info':
        case 'error':
        case 'fatal':
            return level;
        case 'warn':
        case 'warning':
            return 'warning';
        default:
            return undefined;
    }
}

function getDefaultLevel(env: Environment): LogtapeLogLevel {
    return env.NODE_ENV === 'production' ? 'warning' : 'info';
}

function resolveLoggerConfig(options: LoggerOptions = {}, env: Environment = process.env): ResolvedLoggerConfig {
    const isTest = env.NODE_ENV === 'test';
    const level = normalizeLevel(options.level) ?? normalizeLevel(env.LOG_LEVEL) ?? getDefaultLevel(env);

    return {
        level,
        console: options.console ?? parseBooleanEnv(env.LOG_TO_CONSOLE) ?? !isTest,
        file: options.file ?? parseBooleanEnv(env.LOG_TO_FILE) ?? true,
        filePath: options.filePath ?? env.LOG_FILE_PATH ?? 'logs/magnifier.log',
        json: options.json ?? env.LOG_JSON === '1',
        category: options.category ?? ROOT_CATEGORY,
    };
}

function getConfiguredRootCategory(): string {
    return resolvedConfig?.category ?? ROOT_CATEGORY;
}

function getCategoryPath(category?: string): string | readonly [string, ...string[]] {
    const rootCategory = getConfiguredRootCategory();

    if (!category) {
        return rootCategory;
    }

    const segments = category.split(':').filter(Boolean);

    if (segments.length === 0) {
        return rootCategory;
    }

    if (segments[0] === rootCategory) {
        return segments as [string, ...string[]];
    }

    return [rootCategory, ...segments];
}

function ensureLogDirectory(filePath: string): string {
    const resolvedPath = resolve(filePath);
    const directory = dirname(resolvedPath);

    mkdirSync(directory, { recursive: true });

    return resolvedPath;
}

export function configureLogger(options: LoggerOptions = {}): void {
    if (configured && Object.keys(options).length === 0) {
        return;
    }

    resetLogger();
    resolvedConfig = resolveLoggerConfig(options);

    const sinks = createLoggerSinks(resolvedConfig);
    const loggers: LogtapeLoggerConfig<string, string>[] = [];

    const rootSinks = Object.keys(sinks).filter((sinkName) => sinkName !== 'meta');

    loggers.push({
        category: resolvedConfig.category,
        lowestLevel: resolvedConfig.level,
        sinks: rootSinks,
    });

    loggers.push({
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: [],
    });

    configureSync({
        reset: true,
        sinks,
        loggers,
    });

    configured = true;
}

export function getLogger(category?: string): Logger {
    if (!configured) {
        configureLogger();
    }

    return getLogtapeLogger(getCategoryPath(category));
}

export function getLoggerConfig(env: Environment = process.env): LoggerConfigResult {
    const config = resolveLoggerConfig({}, env);
    const rootSinks = [config.console ? 'console' : null, config.file ? 'file' : null].filter((sink) => sink !== null);

    return {
        console: config.console,
        file: config.file,
        filePath: config.filePath,
        json: config.json,
        loggers: [
            {
                category: ROOT_CATEGORY,
                lowestLevel: config.level,
                sinks: rootSinks,
            },
            {
                category: ['logtape', 'meta'],
                lowestLevel: 'warning',
                sinks: [],
            },
        ],
    };
}

export function createLoggerSinks(
    config: Pick<LoggerConfigResult, 'console' | 'file' | 'filePath' | 'json'>,
    options: { consoleSink?: Sink } = {},
): Record<string, Sink> {
    const sinks: Record<string, Sink> = {};

    if (config.console) {
        sinks.console =
            options.consoleSink ??
            getConsoleSink({
                formatter: config.json ? getJsonLinesFormatter() : getTextFormatter(),
            });
    }

    if (config.file) {
        const logFilePath = ensureLogDirectory(config.filePath);
        // Close any existing stream before reassigning so we don't leak the
        // descriptor when the helper is called twice (e.g. tests, reconfig).
        if (fileStream) {
            fileStream.end();
            fileStream = null;
        }
        fileStream = createWriteStream(logFilePath, { flags: 'a' });
        const formatter = config.json ? getJsonLinesFormatter() : getTextFormatter();

        sinks.file = (record: LogRecord) => {
            fileStream?.write(`${formatter(record)}\n`);
        };
    }

    return sinks;
}

export function resetLogger(): void {
    if (configured) {
        resetSync();
    }

    configured = false;
    resolvedConfig = null;

    if (fileStream) {
        fileStream.end();
        fileStream = null;
    }
}
