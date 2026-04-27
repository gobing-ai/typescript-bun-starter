import { describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import { formatListHeader, formatListSection } from '../../../src/commands/scaffold/scaffold-list';
import type { FeatureStatus } from '../../../src/commands/scaffold/types/scaffold';
import { buildTestProgram } from '../../helpers/test-program';

function createCollector(): { stream: Writable; output: string[] } {
    const output: string[] = [];
    return {
        output,
        stream: new Writable({
            write(chunk, _e, cb) {
                output.push(chunk.toString());
                cb();
            },
        }),
    };
}

describe('ScaffoldListCommand', () => {
    describe('command registration', () => {
        it('should register scaffold list command', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            expect(scaffold).toBeDefined();
            const list = scaffold?.commands.find((c) => c.name() === 'list');
            expect(list).toBeDefined();
            expect(list?.description()).toContain('List available');
        });
    });

    describe('formatHeader', () => {
        it('should format header with border lines', () => {
            const result = formatListHeader('Test Title');
            const lines = result.split('\n');
            expect(lines.length).toBe(3);
            expect(lines[0]).toContain('═');
            expect(lines[1]).toContain('Test Title');
            expect(lines[2]).toContain('═');
        });

        it('should handle short text', () => {
            const result = formatListHeader('Hi');
            expect(result).toContain('Hi');
            expect(result).toContain('═');
        });

        it('should handle long text', () => {
            const longText = 'A'.repeat(50);
            const result = formatListHeader(longText);
            expect(result).toContain(longText);
        });
    });

    describe('formatSection', () => {
        it('should format section with title', () => {
            const features: FeatureStatus[] = [{ name: 'test', description: 'Test feature', installed: true }];
            const result = formatListSection('Test Section', features, true);
            expect(result).toContain('Test Section');
            expect(result).toContain('test');
            expect(result).toContain('Test feature');
        });

        it('should show ✓ for always installed features', () => {
            const features: FeatureStatus[] = [{ name: 'required', description: 'Required feature', installed: true }];
            const result = formatListSection('Required', features, true);
            expect(result).toContain('✓');
        });

        it('should show ○ for not installed optional features', () => {
            const features: FeatureStatus[] = [{ name: 'optional', description: 'Optional feature', installed: false }];
            const result = formatListSection('Optional', features, false);
            expect(result).toContain('○');
        });

        it('should show [✓] for installed optional features', () => {
            const features: FeatureStatus[] = [
                { name: 'cli', description: 'CLI app', installed: true, workspacePath: 'apps/cli' },
            ];
            const result = formatListSection('Optional', features, false);
            expect(result).toContain('[✓]');
        });

        it('should include workspace path when present', () => {
            const features: FeatureStatus[] = [
                { name: 'cli', description: 'CLI app', installed: true, workspacePath: 'apps/cli' },
            ];
            const result = formatListSection('Optional', features, false);
            expect(result).toContain('apps/cli');
        });

        it('should handle empty feature list', () => {
            const result = formatListSection('Empty', [], false);
            expect(result).toContain('Empty');
        });

        it('should pad feature names', () => {
            const features: FeatureStatus[] = [
                { name: 'ab', description: 'Short name', installed: false },
                { name: 'abcdefghij', description: 'Long name', installed: false },
            ];
            const result = formatListSection('Test', features, false);
            expect(result).toContain('ab          ');
        });
    });

    describe('execute (integration)', () => {
        it('should output text format with section headers', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list'], { from: 'user' });
            const result = output.join('');
            expect(result).toContain('Required');
            expect(result).toContain('Optional');
            expect(result).toContain('Usage');
        });

        it('should show all required features', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list'], { from: 'user' });
            const result = output.join('');
            expect(result).toContain('contracts');
            expect(result).toContain('core');
        });

        it('should show optional features', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list'], { from: 'user' });
            const result = output.join('');
            expect(result).toContain('cli');
            expect(result).toContain('server');
            expect(result).toContain('webapp');
        });

        it('should show usage hints', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list'], { from: 'user' });
            const result = output.join('');
            expect(result).toContain('scaffold add');
            expect(result).toContain('scaffold remove');
        });

        it('should output JSON when --json flag is set', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list', '--json'], { from: 'user' });
            const json = JSON.parse(output.join(''));
            expect(json.required).toBeDefined();
            expect(json.optional).toBeDefined();
            expect(Array.isArray(json.required)).toBe(true);
            expect(Array.isArray(json.optional)).toBe(true);
        });

        it('should mark all required features as installed', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list', '--json'], { from: 'user' });
            const json = JSON.parse(output.join(''));
            for (const feature of json.required) {
                expect(feature.installed).toBe(true);
                expect(feature.name).toBeDefined();
                expect(feature.description).toBeDefined();
            }
        });

        it('should include workspace paths for workspace features', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'list', '--json'], { from: 'user' });
            const json = JSON.parse(output.join(''));
            for (const feature of json.optional) {
                if (feature.name === 'cli' || feature.name === 'server' || feature.name === 'webapp') {
                    expect(feature.workspacePath).toBeDefined();
                }
            }
        });
    });
});
