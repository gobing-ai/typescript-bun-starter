import { Command } from '@commander-js/extra-typings';
import { registerScaffoldCommands } from '../../src/commands/scaffold/index';

/**
 * Build a commander program for test use.
 *
 * - `exitOverride()` prevents `process.exit()` during tests.
 * - Command action output goes to injected stdout/stderr streams.
 */
export function buildTestProgram(out?: NodeJS.WritableStream, err?: NodeJS.WritableStream) {
    const program = new Command();

    program.exitOverride();

    registerScaffoldCommands(program, out, err);

    return { program, stdout: out, stderr: err };
}
