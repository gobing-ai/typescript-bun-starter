import { describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import { Cli, Option } from 'clipanion';

// Import the actual base class
import { BaseScaffoldCommand } from '../../../src/commands/scaffold/base-scaffold-command';

// Create a concrete implementation that exposes protected methods
class TestScaffoldCommand extends BaseScaffoldCommand {
    dryRun = Option.Boolean('--dry-run', false);
    json = Option.Boolean('--json', false);

    protected override execute(): Promise<number> {
        return Promise.resolve(0);
    }

    // Expose protected methods for testing
    testWriteOutput(data: unknown, error?: string): number {
        return this.writeOutput(data, error);
    }

    testFormatDryRunPreview(files: string[], action: string): string {
        return this.formatDryRunPreview(files, action);
    }

    testWriteSuccess(message: string): void {
        this.writeSuccess(message);
    }
}

function createMockWritable(collector: string[]) {
    return new Writable({
        write(chunk, _encoding, callback) {
            collector.push(chunk.toString());
            callback();
        },
    });
}

function makeCli() {
    const cli = new Cli({ binaryName: 'tbs' });
    cli.register(TestScaffoldCommand);
    return cli;
}

describe('BaseScaffoldCommand', () => {
    describe('dryRun option', () => {
        it('should be defined as Option.Boolean', () => {
            const cmd = new TestScaffoldCommand();
            expect(cmd.dryRun).toBeDefined();
        });

        it('should parse --dry-run flag', async () => {
            const cli = makeCli();
            const cmd = cli.process(['--dry-run']) as TestScaffoldCommand;
            expect(cmd.dryRun).toBe(true);
        });

        it('should default to false', async () => {
            const cli = makeCli();
            const cmd = cli.process([]) as TestScaffoldCommand;
            expect(cmd.dryRun).toBe(false);
        });
    });

    describe('json option', () => {
        it('should be defined as Option.Boolean', () => {
            const cmd = new TestScaffoldCommand();
            expect(cmd.json).toBeDefined();
        });

        it('should parse --json flag', async () => {
            const cli = makeCli();
            const cmd = cli.process(['--json']) as TestScaffoldCommand;
            expect(cmd.json).toBe(true);
        });

        it('should default to false', async () => {
            const cli = makeCli();
            const cmd = cli.process([]) as TestScaffoldCommand;
            expect(cmd.json).toBe(false);
        });
    });

    describe('writeOutput', () => {
        it('should return 0 for success in JSON mode', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['--json'], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            const exitCode = cmd.testWriteOutput({ success: true });
            expect(exitCode).toBe(0);
        });

        it('should output JSON to stdout in JSON mode', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['--json'], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            cmd.testWriteOutput({ success: true, files: ['a.ts', 'b.ts'] });
            const output = JSON.parse(stdout.join(''));
            expect(output.success).toBe(true);
            expect(output.files).toEqual(['a.ts', 'b.ts']);
        });

        it('should return 1 for error in text mode', async () => {
            const cli = makeCli();
            const stderr: string[] = [];
            const cmd = cli.process([], { stderr: createMockWritable(stderr) }) as TestScaffoldCommand;

            const exitCode = cmd.testWriteOutput(null, 'Something went wrong');
            expect(exitCode).toBe(1);
            expect(stderr).toEqual(['Error: Something went wrong\n']);
        });

        it('should return 1 for error in JSON mode', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['--json'], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            const exitCode = cmd.testWriteOutput(null, 'Error message');
            expect(exitCode).toBe(1);
            const output = JSON.parse(stdout.join(''));
            expect(output.error).toBe('Error message');
        });

        it('should not write to stdout in text mode without error', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process([], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            const exitCode = cmd.testWriteOutput({ data: 'test' });
            expect(exitCode).toBe(0);
            expect(stdout.length).toBe(0);
        });

        it('should output nested objects correctly', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['--json'], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            cmd.testWriteOutput({ nested: { deep: { value: 123 } } });
            const output = JSON.parse(stdout.join(''));
            expect(output.nested.deep.value).toBe(123);
        });
    });

    describe('formatDryRunPreview', () => {
        it('should return "No changes needed" for empty files', () => {
            const cmd = new TestScaffoldCommand();
            const result = cmd.testFormatDryRunPreview([], 'write');
            expect(result).toBe('No changes needed.');
        });

        it('should format files with "delete" header', () => {
            const cmd = new TestScaffoldCommand();
            const files = ['file1.ts', 'file2.ts'];
            const result = cmd.testFormatDryRunPreview(files, 'delete');
            expect(result).toContain('Files that would be deleted:');
            expect(result).toContain('  - file1.ts');
            expect(result).toContain('  - file2.ts');
        });

        it('should format files with "add" header', () => {
            const cmd = new TestScaffoldCommand();
            const files = ['new-file.ts'];
            const result = cmd.testFormatDryRunPreview(files, 'add');
            expect(result).toContain('Files that would be added:');
            expect(result).toContain('  - new-file.ts');
        });

        it('should format files with "write" header', () => {
            const cmd = new TestScaffoldCommand();
            const files = ['modified.ts'];
            const result = cmd.testFormatDryRunPreview(files, 'write');
            expect(result).toContain('Files that would be modified:');
        });

        it('should use default header for unknown action', () => {
            const cmd = new TestScaffoldCommand();
            const files = ['file.ts'];
            const result = cmd.testFormatDryRunPreview(files, 'unknown');
            expect(result).toContain('Files that would change:');
        });

        it('should handle single file', () => {
            const cmd = new TestScaffoldCommand();
            const result = cmd.testFormatDryRunPreview(['single.ts'], 'delete');
            expect(result).toContain('single.ts');
        });

        it('should handle paths with directories', () => {
            const cmd = new TestScaffoldCommand();
            const files = ['apps/cli/src/index.ts', 'apps/server/src/index.ts'];
            const result = cmd.testFormatDryRunPreview(files, 'add');
            expect(result).toContain('apps/cli/src/index.ts');
            expect(result).toContain('apps/server/src/index.ts');
        });
    });

    describe('writeSuccess', () => {
        it('should write message to stdout in text mode', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process([], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            cmd.testWriteSuccess('Operation completed successfully');
            expect(stdout[0]).toBe('Operation completed successfully\n');
        });

        it('should not write to stdout in JSON mode', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['--json'], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            cmd.testWriteSuccess('This should not appear');
            expect(stdout.length).toBe(0);
        });

        it('should write multi-word messages', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process([], { stdout: createMockWritable(stdout) }) as TestScaffoldCommand;

            cmd.testWriteSuccess('Feature skills removed successfully');
            expect(stdout[0]).toBe('Feature skills removed successfully\n');
        });
    });
});
