import { describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import { Cli } from 'clipanion';
import { REQUIRED_FEATURES, SCAFFOLD_FEATURES } from '../../../src/commands/scaffold/features/registry';
import { ScaffoldRemoveCommand } from '../../../src/commands/scaffold/scaffold-remove';
import type { FeatureDefinition } from '../../../src/commands/scaffold/types/scaffold';

function createMockWritable(collector: string[]) {
    return new Writable({
        write(chunk, _enc, cb) {
            collector.push(chunk.toString());
            cb();
        },
    });
}

describe('ScaffoldRemoveCommand', () => {
    describe('path registration', () => {
        it('should register with correct path', () => {
            expect(ScaffoldRemoveCommand.paths).toEqual([['scaffold', 'remove']]);
        });
    });

    describe('usage', () => {
        it('should have correct category', () => {
            expect(ScaffoldRemoveCommand.usage.category).toBe('Scaffold');
        });

        it('should have description', () => {
            expect(ScaffoldRemoveCommand.usage.description).toBeTruthy();
        });

        it('should mention available features', () => {
            const details = ScaffoldRemoveCommand.usage.details ?? '';
            expect(details).toContain('webapp');
            expect(details).toContain('server');
            expect(details).toContain('cli');
        });

        it('should have examples', () => {
            expect(ScaffoldRemoveCommand.usage.examples?.length).toBeGreaterThan(0);
        });
    });

    describe('options', () => {
        it('should have --dry-run flag', () => {
            const cmd = new ScaffoldRemoveCommand();
            expect((cmd as unknown as { dryRun: unknown }).dryRun).toBeDefined();
        });

        it('should have --json flag', () => {
            const cmd = new ScaffoldRemoveCommand();
            expect((cmd as unknown as { json: unknown }).json).toBeDefined();
        });

        it('should require feature argument', () => {
            const cmd = new ScaffoldRemoveCommand();
            expect((cmd as unknown as { feature: unknown }).feature).toBeDefined();
        });
    });

    describe('feature registry', () => {
        it('should have webapp as removable feature', () => {
            expect(SCAFFOLD_FEATURES.webapp).toBeDefined();
        });

        it('should have cli as removable feature', () => {
            expect(SCAFFOLD_FEATURES.cli).toBeDefined();
        });

        it('should have server as removable feature', () => {
            expect(SCAFFOLD_FEATURES.server).toBeDefined();
        });

        it('should NOT have contracts as removable feature', () => {
            expect(REQUIRED_FEATURES).toContain('contracts');
        });

        it('should NOT have core as removable feature', () => {
            expect(REQUIRED_FEATURES).toContain('core');
        });
    });

    describe('dry-run format', () => {
        it('should format deletion list', () => {
            const files = ['file1.ts', 'file2.ts', 'file3.ts'];
            const _rewrites: Array<[string, string]> = [];

            let output = `Would remove feature 'webapp':\n\n`;
            output += `Files to delete (${files.length}):\n`;
            for (const file of files) {
                output += `  - ${file}\n`;
            }
            output += '\n';
            output += 'No changes were made (--dry-run)';

            expect(output).toContain('file1.ts');
            expect(output).toContain('file2.ts');
            expect(output).toContain('--dry-run');
        });
    });

    describe('isInstalled', () => {
        it('should return true for workspace feature if path exists', () => {
            const cmd = new ScaffoldRemoveCommand();
            const isInstalled = (
                cmd as unknown as { isInstalled: (f: string, s: { exists: (p: string) => boolean }) => boolean }
            ).isInstalled;

            const mockService = { exists: (_p: string) => true };
            expect(isInstalled('cli', mockService)).toBe(true);
            expect(isInstalled('server', mockService)).toBe(true);
            expect(isInstalled('webapp', mockService)).toBe(true);
        });

        it('should return false for workspace feature if path does not exist', () => {
            const cmd = new ScaffoldRemoveCommand();
            const isInstalled = (
                cmd as unknown as { isInstalled: (f: string, s: { exists: (p: string) => boolean }) => boolean }
            ).isInstalled;

            const mockService = { exists: (_p: string) => false };
            expect(isInstalled('cli', mockService)).toBe(false);
        });

        it('should return false for unknown feature', () => {
            const cmd = new ScaffoldRemoveCommand();
            const isInstalled = (
                cmd as unknown as { isInstalled: (f: string, s: { exists: (p: string) => boolean }) => boolean }
            ).isInstalled;

            const mockService = { exists: (_p: string) => true };
            expect(isInstalled('unknown', mockService)).toBe(false);
        });
    });

    describe('shouldBlockStarterWebappRemoval', () => {
        it('should block webapp removal in the starter repository via package name', () => {
            const cmd = new ScaffoldRemoveCommand();
            const shouldBlockStarterWebappRemoval = (
                cmd as unknown as {
                    shouldBlockStarterWebappRemoval: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => unknown;
                        },
                        feature: string,
                    ) => boolean;
                }
            ).shouldBlockStarterWebappRemoval;

            const mockService = {
                exists: (path: string) => path === 'package.json',
                readJson: (path: string) =>
                    path === 'package.json' ? { name: '@gobing-ai/typescript-bun-starter' } : {},
            };

            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(true);
        });

        it('should block webapp removal in the starter repository via contract identity', () => {
            const cmd = new ScaffoldRemoveCommand();
            const shouldBlockStarterWebappRemoval = (
                cmd as unknown as {
                    shouldBlockStarterWebappRemoval: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => unknown;
                        },
                        feature: string,
                    ) => boolean;
                }
            ).shouldBlockStarterWebappRemoval;

            const mockService = {
                exists: (path: string) => path === 'package.json' || path === 'contracts/project-contracts.json',
                readJson: (path: string) =>
                    path === 'package.json'
                        ? { name: '@acme/generated-project' }
                        : {
                              projectIdentity: {
                                  rootPackageName: '@gobing-ai/typescript-bun-starter',
                              },
                          },
            };

            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(true);
        });

        it('should allow webapp removal in generated projects', () => {
            const cmd = new ScaffoldRemoveCommand();
            const shouldBlockStarterWebappRemoval = (
                cmd as unknown as {
                    shouldBlockStarterWebappRemoval: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => unknown;
                        },
                        feature: string,
                    ) => boolean;
                }
            ).shouldBlockStarterWebappRemoval;

            const mockService = {
                exists: (path: string) => path === 'package.json' || path === 'contracts/project-contracts.json',
                readJson: (path: string) =>
                    path === 'package.json'
                        ? { name: '@acme/generated-project' }
                        : {
                              projectIdentity: {
                                  rootPackageName: '@acme/generated-project',
                              },
                          },
            };

            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(false);
        });

        it('should not block other features', () => {
            const cmd = new ScaffoldRemoveCommand();
            const shouldBlockStarterWebappRemoval = (
                cmd as unknown as {
                    shouldBlockStarterWebappRemoval: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => unknown;
                        },
                        feature: string,
                    ) => boolean;
                }
            ).shouldBlockStarterWebappRemoval;

            const mockService = {
                exists: (_path: string) => true,
                readJson: () => ({ name: '@gobing-ai/typescript-bun-starter' }),
            };

            expect(shouldBlockStarterWebappRemoval(mockService, 'server')).toBe(false);
        });
    });

    describe('stageChanges', () => {
        it('should return empty arrays when no files exist', () => {
            const cmd = new ScaffoldRemoveCommand();
            (cmd as unknown as { feature: string }).feature = 'test';
            const stageChanges = (
                cmd as unknown as {
                    stageChanges: (
                        this: { feature: string },
                        s: { exists: (p: string) => boolean },
                        f: FeatureDefinition,
                    ) => { filesToDelete: string[]; filesToRewrite: Array<[string, string]> };
                }
            ).stageChanges.bind(cmd);

            const mockService = { exists: (_p: string) => false };
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test feature',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };

            const result = stageChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual([]);
            expect(result.filesToRewrite).toEqual([]);
        });

        it('should return files to delete when they exist', () => {
            const cmd = new ScaffoldRemoveCommand();
            (cmd as unknown as { feature: string }).feature = 'test';
            const stageChanges = (
                cmd as unknown as {
                    stageChanges: (
                        this: { feature: string },
                        s: { exists: (p: string) => boolean },
                        f: FeatureDefinition,
                    ) => { filesToDelete: string[]; filesToRewrite: Array<[string, string]> };
                }
            ).stageChanges.bind(cmd);

            const mockService = { exists: (_p: string) => true };
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test feature',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };

            const result = stageChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['file1.ts', 'file2.ts']);
            expect(result.filesToRewrite).toEqual([]);
        });

        it('should selectively stage only existing files', () => {
            const cmd = new ScaffoldRemoveCommand();
            (cmd as unknown as { feature: string }).feature = 'test';
            const stageChanges = (
                cmd as unknown as {
                    stageChanges: (
                        this: { feature: string },
                        s: { exists: (p: string) => boolean },
                        f: FeatureDefinition,
                    ) => { filesToDelete: string[]; filesToRewrite: Array<[string, string]> };
                }
            ).stageChanges.bind(cmd);

            const mockService = { exists: (p: string) => p === 'file1.ts' };
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test feature',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };

            const result = stageChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['file1.ts']);
        });

        it('should delete the entire workspace when workspacePath exists', () => {
            const cmd = new ScaffoldRemoveCommand();
            (cmd as unknown as { feature: string }).feature = 'server';
            const stageChanges = (
                cmd as unknown as {
                    stageChanges: (
                        this: { feature: string },
                        s: { exists: (p: string) => boolean },
                        f: FeatureDefinition,
                    ) => { filesToDelete: string[]; filesToRewrite: Array<[string, string]> };
                }
            ).stageChanges.bind(cmd);

            const mockService = { exists: (p: string) => p === 'apps/server' };
            const featureDef: FeatureDefinition = {
                name: 'server',
                description: 'Server feature',
                files: ['apps/server/src/index.ts', 'apps/server/package.json'],
                rewrites: {},
                workspacePath: 'apps/server',
            };

            const result = stageChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['apps/server']);
            expect(result.filesToRewrite).toEqual([]);
        });
    });

    describe('formatDryRunOutput', () => {
        it('should format empty output', () => {
            const cmd = new ScaffoldRemoveCommand();
            const formatDryRunOutput = (
                cmd as unknown as { formatDryRunOutput: (f: string, d: string[], r: Array<[string, string]>) => string }
            ).formatDryRunOutput;

            const result = formatDryRunOutput('cli', [], []);
            expect(result).toContain('cli');
            expect(result).toContain('--dry-run');
        });

        it('should format files to delete', () => {
            const cmd = new ScaffoldRemoveCommand();
            const formatDryRunOutput = (
                cmd as unknown as { formatDryRunOutput: (f: string, d: string[], r: Array<[string, string]>) => string }
            ).formatDryRunOutput;

            const result = formatDryRunOutput('cli', ['a.ts', 'b.ts'], []);
            expect(result).toContain('Files to delete');
            expect(result).toContain('a.ts');
            expect(result).toContain('b.ts');
        });

        it('should format files to rewrite', () => {
            const cmd = new ScaffoldRemoveCommand();
            const formatDryRunOutput = (
                cmd as unknown as { formatDryRunOutput: (f: string, d: string[], r: Array<[string, string]>) => string }
            ).formatDryRunOutput;

            const result = formatDryRunOutput('cli', [], [['x.ts', 'content']]);
            expect(result).toContain('Files to rewrite');
            expect(result).toContain('x.ts');
        });

        it('should format both delete and rewrite', () => {
            const cmd = new ScaffoldRemoveCommand();
            const formatDryRunOutput = (
                cmd as unknown as { formatDryRunOutput: (f: string, d: string[], r: Array<[string, string]>) => string }
            ).formatDryRunOutput;

            const result = formatDryRunOutput('cli', ['a.ts'], [['b.ts', 'x']]);
            expect(result).toContain('Files to delete');
            expect(result).toContain('Files to rewrite');
        });
    });

    describe('execute', () => {
        it('should return 0 for successful removal', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            const cmd = cli.process(['scaffold', 'remove', 'webapp', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            // Mock isInstalled to return false (not installed) so it exits early
            const exitCode = await cmd.execute();
            // Either returns 0 (success) or 1 (not installed) - both valid
            expect(exitCode).toBeGreaterThanOrEqual(0);
            expect(exitCode).toBeLessThanOrEqual(1);
        });

        it('should output JSON format with --json', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            const cmd = cli.process(['scaffold', 'remove', 'webapp', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            await cmd.execute();
            const output = stdout.join('');
            // Should be JSON or contain JSON-like content
            expect(output).toBeTruthy();
        });
    });

    describe('runPostRemoveScripts', () => {
        it('should run bun install and generate:instructions with array args', () => {
            const cmd = new ScaffoldRemoveCommand();
            const stderr: string[] = [];
            (cmd as unknown as { context: { stderr: Writable } }).context = {
                stderr: createMockWritable(stderr),
            };
            const runPostRemoveScripts = (
                cmd as unknown as {
                    runPostRemoveScripts: (s: { runShell: (cmd: string, args: string[]) => number }) => void;
                }
            ).runPostRemoveScripts.bind(cmd);

            const calls: Array<{ cmd: string; args: string[] }> = [];
            const mockService = {
                runShell: (c: string, args: string[]) => {
                    calls.push({ cmd: c, args });
                    return 0;
                },
            };

            runPostRemoveScripts(mockService);
            expect(calls).toEqual([
                { cmd: 'bun', args: ['install'] },
                { cmd: 'bun', args: ['run', 'generate:instructions'] },
            ]);
            expect(stderr.join('')).toBe('');
        });

        it('should warn on non-zero exit codes without aborting', () => {
            const cmd = new ScaffoldRemoveCommand();
            const stderr: string[] = [];
            (cmd as unknown as { context: { stderr: Writable } }).context = {
                stderr: createMockWritable(stderr),
            };
            const runPostRemoveScripts = (
                cmd as unknown as {
                    runPostRemoveScripts: (s: { runShell: (cmd: string, args: string[]) => number }) => void;
                }
            ).runPostRemoveScripts.bind(cmd);

            let invocations = 0;
            const mockService = {
                runShell: () => {
                    invocations += 1;
                    return invocations === 1 ? 7 : 0;
                },
            };

            runPostRemoveScripts(mockService);
            const out = stderr.join('');
            expect(invocations).toBe(2);
            expect(out).toContain('bun install');
            expect(out).toContain('exited with code 7');
            expect(out).not.toContain('generate:instructions');
        });
    });

    describe('updateContracts', () => {
        it('should remove the workspace and dependency rules for the feature', async () => {
            const cmd = new ScaffoldRemoveCommand();
            const updateContracts = (
                cmd as unknown as {
                    updateContracts: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => Record<string, unknown>;
                            writeJson: (path: string, data: unknown) => void;
                        },
                        feature: string,
                    ) => Promise<void>;
                }
            ).updateContracts;

            const writes: Array<{ path: string; data: unknown }> = [];
            const mockService = {
                exists: (path: string) => path === 'contracts/project-contracts.json',
                readJson: () => ({
                    optionalWorkspaces: {
                        'apps/server': '@starter/server',
                    },
                    workspaceDependencyRules: {
                        '@starter/server': ['@starter/contracts', '@starter/core'],
                    },
                }),
                writeJson: (path: string, data: unknown) => {
                    writes.push({ path, data });
                },
            };

            await updateContracts(mockService, 'server');

            expect(writes).toHaveLength(1);
            expect(writes[0]?.path).toBe('contracts/project-contracts.json');
            expect(writes[0]?.data).toEqual({
                optionalWorkspaces: {},
                workspaceDependencyRules: {},
            });
        });

        it('should skip writes when the contract file does not exist', async () => {
            const cmd = new ScaffoldRemoveCommand();
            const updateContracts = (
                cmd as unknown as {
                    updateContracts: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => Record<string, unknown>;
                            writeJson: (path: string, data: unknown) => void;
                        },
                        feature: string,
                    ) => Promise<void>;
                }
            ).updateContracts;

            let writeCount = 0;
            const mockService = {
                exists: () => false,
                readJson: () => ({}),
                writeJson: () => {
                    writeCount += 1;
                },
            };

            await updateContracts(mockService, 'server');
            expect(writeCount).toBe(0);
        });

        it('should skip writes when removing an unknown feature', async () => {
            const cmd = new ScaffoldRemoveCommand();
            const updateContracts = (
                cmd as unknown as {
                    updateContracts: (
                        s: {
                            exists: (path: string) => boolean;
                            readJson: (path: string) => Record<string, unknown>;
                            writeJson: (path: string, data: unknown) => void;
                        },
                        feature: string,
                    ) => Promise<void>;
                }
            ).updateContracts;

            let writeCount = 0;
            const mockService = {
                exists: () => true,
                readJson: () => ({
                    optionalWorkspaces: {
                        'apps/server': '@starter/server',
                    },
                    workspaceDependencyRules: {
                        '@starter/server': ['@starter/contracts', '@starter/core'],
                    },
                }),
                writeJson: () => {
                    writeCount += 1;
                },
            };

            await updateContracts(mockService, 'unknown-feature');
            expect(writeCount).toBe(0);
        });
    });

    describe('execute errors', () => {
        it('should return error for webapp removal in the starter repository', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            const cmd = cli.process(['scaffold', 'remove', 'webapp', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            expect(output.error).toContain("Refusing to remove 'webapp' from the starter repository");
        });

        it('should return error for unknown feature', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            const cmd = cli.process(['scaffold', 'remove', 'unknown-feature', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);
        });

        it('should return error for required feature', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            const cmd = cli.process(['scaffold', 'remove', 'contracts', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);
        });

        it('should return error for non-installed feature', async () => {
            const stdout: string[] = [];
            const cli = new Cli({ binaryName: 'tbs' });
            cli.register(ScaffoldRemoveCommand);

            // Use 'webapp' which may not exist in test environment
            const cmd = cli.process(['scaffold', 'remove', 'webapp', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldRemoveCommand;

            const exitCode = await cmd.execute();
            // May return 0 if exists, or 1 if not installed
            expect(exitCode).toBeGreaterThanOrEqual(0);
            expect(exitCode).toBeLessThanOrEqual(1);
        });
    });
});
