import { Command, Option } from 'clipanion';

/**
 * Base class for all scaffold commands.
 * Provides shared options and utility methods.
 */
export abstract class BaseScaffoldCommand extends Command {
    /**
     * @internal
     */
    constructor() {
        super();
    }

    dryRun = Option.Boolean('--dry-run', false, {
        description: 'Preview changes without applying',
    });

    json = Option.Boolean('--json', false, {
        description: 'Output as JSON (agent mode)',
    });

    /**
     * Write output based on mode (text vs JSON)
     * @returns Exit code (0 for success, 1 for error)
     */
    protected writeOutput(data: unknown, error?: string): number {
        if (this.json) {
            const output =
                error && data && typeof data === 'object'
                    ? { error, ...(data as Record<string, unknown>) }
                    : error
                      ? { error, data }
                      : data;
            this.context.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        } else if (error) {
            this.context.stderr.write(`Error: ${error}\n`);
        }
        return error ? 1 : 0;
    }

    /**
     * Format files list for dry-run preview
     */
    protected formatDryRunPreview(files: string[], action: string): string {
        if (files.length === 0) {
            return `No changes needed.`;
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
     * Write success message in text mode
     */
    protected writeSuccess(message: string): void {
        if (!this.json) {
            this.context.stdout.write(`${message}\n`);
        }
    }
}
