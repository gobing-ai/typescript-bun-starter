import { echo, echoError } from '@starter/core';

/**
 * Write output based on mode (text vs JSON).
 * @returns Exit code (0 for success, 1 for error)
 */
export function writeOutput(
    stdout: NodeJS.WritableStream,
    stderr: NodeJS.WritableStream,
    isJson: boolean,
    data: unknown,
    error?: string,
): number {
    if (isJson) {
        const output =
            error && data && typeof data === 'object'
                ? { error, ...(data as Record<string, unknown>) }
                : error
                  ? { error, data }
                  : data;
        stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } else if (error) {
        echoError(`Error: ${error}`, stderr);
    }
    return error ? 1 : 0;
}

/**
 * Format files list for dry-run preview.
 */
export function formatDryRunPreview(files: string[], action: string): string {
    if (files.length === 0) {
        return 'No changes needed.';
    }

    const header =
        action === 'delete'
            ? 'Files that would be deleted:'
            : action === 'add'
              ? 'Files that would be added:'
              : action === 'write'
                ? 'Files that would be modified:'
                : 'Files that would change:';

    const items = files.map((f) => `  - ${f}`).join('\n');
    return `${header}\n${items}`;
}

/**
 * Write success message in text mode.
 * Silently skipped in JSON mode.
 */
export function writeSuccess(stdout: NodeJS.WritableStream, isJson: boolean, message: string): void {
    if (!isJson) {
        echo(message, stdout);
    }
}
