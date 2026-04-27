import { describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import { formatDryRunPreview, writeOutput, writeSuccess } from '../../src/ui/output';

function createCollector(): { stream: Writable; output: string[] } {
    const output: string[] = [];
    return {
        output,
        stream: new Writable({
            write(chunk, _encoding, callback) {
                output.push(chunk.toString());
                callback();
            },
        }),
    };
}

function noopStream(): Writable {
    return new Writable({
        write(_chunk, _encoding, callback) {
            callback();
        },
    });
}

describe('output', () => {
    describe('writeOutput', () => {
        it('should return 0 for success in JSON mode', () => {
            const { stream, output } = createCollector();
            const exitCode = writeOutput(stream, noopStream(), true, { success: true });
            expect(exitCode).toBe(0);
            const parsed = JSON.parse(output.join(''));
            expect(parsed.success).toBe(true);
        });

        it('should output JSON to stdout in JSON mode', () => {
            const { stream, output } = createCollector();
            writeOutput(stream, noopStream(), true, { success: true, files: ['a.ts', 'b.ts'] });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.success).toBe(true);
            expect(parsed.files).toEqual(['a.ts', 'b.ts']);
        });

        it('should return 1 for error in text mode', () => {
            const { stream: stderr } = createCollector();
            const exitCode = writeOutput(noopStream(), stderr, false, null, 'Something went wrong');
            expect(exitCode).toBe(1);
        });

        it('should return 1 for error in JSON mode', () => {
            const { stream, output } = createCollector();
            const exitCode = writeOutput(stream, noopStream(), true, null, 'Error message');
            expect(exitCode).toBe(1);
            const parsed = JSON.parse(output.join(''));
            expect(parsed.error).toBe('Error message');
        });

        it('should not write to stdout in text mode without error', () => {
            const { stream, output } = createCollector();
            const exitCode = writeOutput(stream, noopStream(), false, { data: 'test' });
            expect(exitCode).toBe(0);
            expect(output.length).toBe(0);
        });

        it('should output nested objects correctly', () => {
            const { stream, output } = createCollector();
            writeOutput(stream, noopStream(), true, { nested: { deep: { value: 123 } } });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.nested.deep.value).toBe(123);
        });
    });

    describe('formatDryRunPreview', () => {
        it('should return "No changes needed" for empty files', () => {
            const result = formatDryRunPreview([], 'write');
            expect(result).toBe('No changes needed.');
        });

        it('should format files with "delete" header', () => {
            const files = ['file1.ts', 'file2.ts'];
            const result = formatDryRunPreview(files, 'delete');
            expect(result).toContain('Files that would be deleted:');
            expect(result).toContain('  - file1.ts');
            expect(result).toContain('  - file2.ts');
        });

        it('should format files with "add" header', () => {
            const files = ['new-file.ts'];
            const result = formatDryRunPreview(files, 'add');
            expect(result).toContain('Files that would be added:');
            expect(result).toContain('  - new-file.ts');
        });

        it('should format files with "write" header', () => {
            const files = ['modified.ts'];
            const result = formatDryRunPreview(files, 'write');
            expect(result).toContain('Files that would be modified:');
        });

        it('should use default header for unknown action', () => {
            const files = ['file.ts'];
            const result = formatDryRunPreview(files, 'unknown');
            expect(result).toContain('Files that would change:');
        });

        it('should handle single file', () => {
            const result = formatDryRunPreview(['single.ts'], 'delete');
            expect(result).toContain('single.ts');
        });

        it('should handle paths with directories', () => {
            const files = ['apps/cli/src/index.ts', 'apps/server/src/index.ts'];
            const result = formatDryRunPreview(files, 'add');
            expect(result).toContain('apps/cli/src/index.ts');
            expect(result).toContain('apps/server/src/index.ts');
        });
    });

    describe('writeSuccess', () => {
        it('should write message to stdout in text mode', () => {
            const { stream, output } = createCollector();
            writeSuccess(stream, false, 'Operation completed successfully');
            expect(output[0]).toBe('Operation completed successfully\n');
        });

        it('should not write to stdout in JSON mode', () => {
            const { stream, output } = createCollector();
            writeSuccess(stream, true, 'This should not appear');
            expect(output.length).toBe(0);
        });

        it('should write multi-word messages', () => {
            const { stream, output } = createCollector();
            writeSuccess(stream, false, 'Feature skills removed successfully');
            expect(output[0]).toBe('Feature skills removed successfully\n');
        });
    });
});
