#!/usr/bin/env bun
import { Writable } from 'node:stream';
import { program } from '@commander-js/extra-typings';
import { configure, getConsoleSink, getStreamSink } from '@logtape/logtape';
import { createLoggerSinks, echo, getLoggerConfig } from '@starter/core';
import figlet from 'figlet';
import { registerScaffoldCommands } from './commands/scaffold/index';
import { CLI_CONFIG } from './config';

// Detect JSON agent mode before anything is printed.
const isJsonMode = process.argv.includes('--json');

// ASCII banner (non-JSON mode only)
if (!isJsonMode) {
    try {
        echo(figlet.textSync(CLI_CONFIG.binaryLabel, { font: 'Standard' }), process.stdout);
    } catch {
        // Font file not available in bundled/compiled context — fall back to plain text
        echo(` ${CLI_CONFIG.binaryLabel}\n`, process.stdout);
    }
}

// Logger must be configured before command parsing.
const loggerConfig = getLoggerConfig(process.env);
await configure({
    ...loggerConfig,
    sinks: createLoggerSinks(loggerConfig, {
        consoleSink: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
    }),
});

program.name(CLI_CONFIG.binaryName).description(CLI_CONFIG.binaryLabel).version(CLI_CONFIG.binaryVersion);

registerScaffoldCommands(program);

await program.parseAsync();
