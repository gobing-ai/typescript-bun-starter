#!/usr/bin/env bun
import { Writable } from 'node:stream';
import { configure, getConsoleSink, getStreamSink } from '@logtape/logtape';
import { createLoggerSinks, getLoggerConfig } from '@starter/core';
import { Builtins, Cli } from 'clipanion';

import { CLI_CONFIG } from './config';

// Detect JSON agent mode before logging is configured.
const isJsonMode = process.argv.includes('--json');

const loggerConfig = getLoggerConfig(process.env);

await configure({
    ...loggerConfig,
    sinks: createLoggerSinks(loggerConfig, {
        consoleSink: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
    }),
});

const cli = new Cli({
    binaryLabel: CLI_CONFIG.binaryLabel,
    binaryName: CLI_CONFIG.binaryName,
    binaryVersion: CLI_CONFIG.binaryVersion,
});

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2));
