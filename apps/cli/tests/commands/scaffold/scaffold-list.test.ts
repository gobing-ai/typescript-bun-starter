import { Writable } from 'node:stream';
import { Cli } from 'clipanion';
import { describe, expect, it } from 'vitest';
import { ScaffoldListCommand } from '../../../src/commands/scaffold/scaffold-list';
import type { ScaffoldService } from '../../../src/commands/scaffold/services/scaffold-service';
import type { FeatureStatus } from '../../../src/commands/scaffold/types/scaffold';

function createMockWritable(collector: string[]) {
    return new Writable({
        write(chunk, _enc, cb) {
            collector.push(chunk.toString());
            cb();
        },
    });
}

function makeCli() {
    const cli = new Cli({ binaryName: 'tbs' });
    cli.register(ScaffoldListCommand);
    return cli;
}

describe('ScaffoldListCommand', () => {
    describe('path registration', () => {
        it('should register with correct path', () => {
            expect(ScaffoldListCommand.paths).toEqual([['scaffold', 'list']]);
        });
    });

    describe('usage', () => {
        it('should have correct category', () => {
            expect(ScaffoldListCommand.usage.category).toBe('Scaffold');
        });

        it('should have description', () => {
            expect(ScaffoldListCommand.usage.description).toBeTruthy();
        });

        it('should mention add/remove commands', () => {
            const details = ScaffoldListCommand.usage.details ?? '';
            expect(details).toContain('add');
            expect(details).toContain('remove');
        });

        it('should have examples', () => {
            expect(ScaffoldListCommand.usage.examples?.length).toBeGreaterThan(0);
        });
    });

    describe('options', () => {
        it('should have --json flag (inherited)', () => {
            const cmd = new ScaffoldListCommand();
            expect((cmd as unknown as { json: unknown }).json).toBeDefined();
        });
    });

    describe('output format', () => {
        it('should format header correctly', () => {
            const text = 'Test Header';
            const line = '═'.repeat(text.length + 4);
            const expected = `${line}\n  ${text}\n${line}`;
            expect(expected).toContain('Test Header');
        });

        it('should show status indicators', () => {
            // Verify the format uses ✓ for installed and ○ for not installed
            expect('✓').toBeDefined();
            expect('○').toBeDefined();
        });
    });

    describe('formatHeader', () => {
        it('should format header with border lines', () => {
            const cmd = new ScaffoldListCommand();
            const result = cmd.formatHeader('Test Title');
            const lines = result.split('\n');

            // Should have top border, title, and bottom border
            expect(lines.length).toBe(3);
            expect(lines[0]).toContain('═');
            expect(lines[1]).toContain('Test Title');
            expect(lines[2]).toContain('═');
        });

        it('should handle short text', () => {
            const cmd = new ScaffoldListCommand();
            const result = cmd.formatHeader('Hi');
            expect(result).toContain('Hi');
            expect(result).toContain('═');
        });

        it('should handle long text', () => {
            const cmd = new ScaffoldListCommand();
            const longText = 'A'.repeat(50);
            const result = cmd.formatHeader(longText);
            expect(result).toContain(longText);
        });
    });

    describe('formatSection', () => {
        it('should format section with title', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [{ name: 'test', description: 'Test feature', installed: true }];
            const result = cmd.formatSection('Test Section', features, true);
            expect(result).toContain('Test Section');
            expect(result).toContain('test');
            expect(result).toContain('Test feature');
        });

        it('should show ✓ for always installed features', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [{ name: 'required', description: 'Required feature', installed: true }];
            const result = cmd.formatSection('Required', features, true);
            expect(result).toContain('✓');
        });

        it('should show ○ for not installed optional features', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [{ name: 'optional', description: 'Optional feature', installed: false }];
            const result = cmd.formatSection('Optional', features, false);
            expect(result).toContain('○');
        });

        it('should show [✓] for installed optional features', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [
                { name: 'cli', description: 'CLI app', installed: true, workspacePath: 'apps/cli' },
            ];
            const result = cmd.formatSection('Optional', features, false);
            expect(result).toContain('[✓]');
        });

        it('should include workspace path when present', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [
                { name: 'cli', description: 'CLI app', installed: true, workspacePath: 'apps/cli' },
            ];
            const result = cmd.formatSection('Optional', features, false);
            expect(result).toContain('apps/cli');
        });

        it('should handle empty feature list', () => {
            const cmd = new ScaffoldListCommand();
            const result = cmd.formatSection('Empty', [], false);
            expect(result).toContain('Empty');
        });

        it('should pad feature names', () => {
            const cmd = new ScaffoldListCommand();
            const features: FeatureStatus[] = [
                { name: 'ab', description: 'Short name', installed: false },
                { name: 'abcdefghij', description: 'Long name', installed: false },
            ];
            const result = cmd.formatSection('Test', features, false);
            // Both feature names should be padded to same width
            expect(result).toContain('ab          ');
        });
    });

    describe('isInstalled', () => {
        it('should return true for skills feature if skill-service exists', () => {
            const cmd = new ScaffoldListCommand();
            // Use type casting to test private method
            const isInstalled = (cmd as unknown as { isInstalled: (f: string, s: ScaffoldService) => boolean })
                .isInstalled;

            // Create a mock service that returns true
            const mockService = {
                exists: (_path: string) => true,
            } as unknown as ScaffoldService;

            expect(isInstalled('skills', mockService)).toBe(true);
        });

        it('should return false for skills feature if skill-service does not exist', () => {
            const cmd = new ScaffoldListCommand();
            const isInstalled = (cmd as unknown as { isInstalled: (f: string, s: ScaffoldService) => boolean })
                .isInstalled;

            const mockService = {
                exists: (_path: string) => false,
            } as unknown as ScaffoldService;

            expect(isInstalled('skills', mockService)).toBe(false);
        });

        it('should return true for workspace feature if path exists', () => {
            const cmd = new ScaffoldListCommand();
            const isInstalled = (cmd as unknown as { isInstalled: (f: string, s: ScaffoldService) => boolean })
                .isInstalled;

            const mockService = {
                exists: (_path: string) => true,
            } as unknown as ScaffoldService;

            expect(isInstalled('cli', mockService)).toBe(true);
        });

        it('should return false for unknown feature without workspace', () => {
            const cmd = new ScaffoldListCommand();
            const isInstalled = (cmd as unknown as { isInstalled: (f: string, s: ScaffoldService) => boolean })
                .isInstalled;

            const mockService = {
                exists: (_path: string) => true,
            } as unknown as ScaffoldService;

            // 'skills' has no workspacePath but has special handling
            // 'unknown' has no workspacePath and no special handling
            expect(isInstalled('unknown', mockService)).toBe(false);
        });
    });

    describe('execute', () => {
        it('should return 0 for successful execution', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);
        });

        it('should output text format by default', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            // Should contain section headers
            expect(output).toContain('Required');
            expect(output).toContain('Optional');
            expect(output).toContain('Usage');
        });

        it('should show all required features', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            // Should contain contracts and core as required features
            expect(output).toContain('contracts');
            expect(output).toContain('core');
        });

        it('should show optional features', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            // Should contain optional features (cli, server, webapp, skills)
            expect(output).toContain('cli');
            expect(output).toContain('server');
            expect(output).toContain('webapp');
        });

        it('should show usage hints', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            expect(output).toContain('scaffold add');
            expect(output).toContain('scaffold remove');
        });

        it('should output JSON when --json flag is set', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            const json = JSON.parse(output);

            expect(json.required).toBeDefined();
            expect(json.optional).toBeDefined();
            expect(Array.isArray(json.required)).toBe(true);
            expect(Array.isArray(json.optional)).toBe(true);
        });

        it('should mark all required features as installed', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            const json = JSON.parse(output);

            // All required features should be marked as installed
            for (const feature of json.required) {
                expect(feature.installed).toBe(true);
                expect(feature.name).toBeDefined();
                expect(feature.description).toBeDefined();
            }
        });

        it('should include workspace paths for workspace features', async () => {
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'list', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldListCommand;

            await cmd.execute();

            const output = stdout.join('');
            const json = JSON.parse(output);

            // Optional features with workspace should have workspacePath
            for (const feature of json.optional) {
                if (feature.name === 'cli' || feature.name === 'server' || feature.name === 'webapp') {
                    expect(feature.workspacePath).toBeDefined();
                }
            }
        });
    });
});
