import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chdir, cwd as getCwd } from 'node:process';
import { Writable } from 'node:stream';
import { REQUIRED_FEATURES, SCAFFOLD_FEATURES } from '../../../src/commands/scaffold/features/registry';
import { isFeatureInstalled } from '../../../src/commands/scaffold/scaffold-add';
import {
    formatRemoveDryRunOutput,
    runPostRemoveScripts,
    shouldBlockStarterWebappRemoval,
    stageRemoveChanges,
    updateRemoveContracts,
} from '../../../src/commands/scaffold/scaffold-remove';
import type { ScaffoldService } from '../../../src/commands/scaffold/services/scaffold-service';
import type { FeatureDefinition } from '../../../src/commands/scaffold/types/scaffold';
import { buildTestProgram } from '../../helpers/test-program';

const TEST_DIR = '/tmp/scaffold-remove-test';

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

function setup() {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
    rmSync(TEST_DIR, { recursive: true, force: true });
}

describe('ScaffoldRemoveCommand', () => {
    describe('command registration', () => {
        it('should register scaffold remove command', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            expect(scaffold).toBeDefined();
            const remove = scaffold?.commands.find((c) => c.name() === 'remove');
            expect(remove).toBeDefined();
            expect(remove?.description()).toContain('Remove optional feature');
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

    describe('isFeatureInstalled', () => {
        it('should return true for workspace feature if path exists', () => {
            const mockService = { exists: (_p: string) => true } as ScaffoldService;
            expect(isFeatureInstalled('cli', mockService)).toBe(true);
            expect(isFeatureInstalled('server', mockService)).toBe(true);
            expect(isFeatureInstalled('webapp', mockService)).toBe(true);
        });

        it('should return false for workspace feature if path does not exist', () => {
            const mockService = { exists: (_p: string) => false } as ScaffoldService;
            expect(isFeatureInstalled('cli', mockService)).toBe(false);
        });

        it('should return false for unknown feature', () => {
            const mockService = { exists: (_p: string) => true } as ScaffoldService;
            expect(isFeatureInstalled('unknown', mockService)).toBe(false);
        });
    });

    describe('shouldBlockStarterWebappRemoval', () => {
        it('should block webapp removal in the starter repository via package name', () => {
            const mockService = {
                exists: (path: string) => path === 'package.json',
                readJson: (path: string) =>
                    path === 'package.json' ? { name: '@gobing-ai/typescript-bun-starter' } : {},
            } as unknown as ScaffoldService;
            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(true);
        });

        it('should block webapp removal via contract identity', () => {
            const mockService = {
                exists: (path: string) => path === 'package.json' || path === 'contracts/project-contracts.json',
                readJson: (path: string) =>
                    path === 'package.json'
                        ? { name: '@acme/generated-project' }
                        : { projectIdentity: { rootPackageName: '@gobing-ai/typescript-bun-starter' } },
            } as unknown as ScaffoldService;
            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(true);
        });

        it('should allow webapp removal in generated projects', () => {
            const mockService = {
                exists: (path: string) => path === 'package.json' || path === 'contracts/project-contracts.json',
                readJson: (path: string) =>
                    path === 'package.json'
                        ? { name: '@acme/generated-project' }
                        : { projectIdentity: { rootPackageName: '@acme/generated-project' } },
            } as unknown as ScaffoldService;
            expect(shouldBlockStarterWebappRemoval(mockService, 'webapp')).toBe(false);
        });

        it('should not block other features', () => {
            const mockService = {
                exists: (_path: string) => true,
                readJson: () => ({ name: '@gobing-ai/typescript-bun-starter' }),
            } as unknown as ScaffoldService;
            expect(shouldBlockStarterWebappRemoval(mockService, 'server')).toBe(false);
        });
    });

    describe('stageChanges', () => {
        it('should return empty arrays when no files exist', () => {
            const mockService = { exists: (_p: string) => false } as ScaffoldService;
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test feature',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };
            const result = stageRemoveChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual([]);
            expect(result.filesToRewrite).toEqual([]);
        });

        it('should return files to delete when they exist', () => {
            const mockService = { exists: (_p: string) => true } as ScaffoldService;
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test feature',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };
            const result = stageRemoveChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['file1.ts', 'file2.ts']);
            expect(result.filesToRewrite).toEqual([]);
        });

        it('should selectively stage only existing files', () => {
            const mockService = {
                exists: (p: string) => p === 'file1.ts',
            } as ScaffoldService;
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test',
                files: ['file1.ts', 'file2.ts'],
                rewrites: {},
            };
            const result = stageRemoveChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['file1.ts']);
            expect(result.filesToRewrite).toEqual([]);
        });

        it('should delete workspace path when it exists', () => {
            const mockService = {
                exists: (_p: string) => true,
            } as ScaffoldService;
            const featureDef: FeatureDefinition = {
                name: 'test',
                description: 'Test',
                files: ['some-file.ts'],
                rewrites: {},
                workspacePath: 'apps/test',
            };
            const result = stageRemoveChanges(mockService, featureDef);
            expect(result.filesToDelete).toEqual(['apps/test']);
            expect(result.filesToRewrite).toEqual([]);
        });
    });

    describe('formatRemoveDryRunOutput', () => {
        it('should format deletion list', () => {
            const files = ['file1.ts', 'file2.ts', 'file3.ts'];
            const rewrites: Array<[string, string]> = [];
            const result = formatRemoveDryRunOutput('webapp', files, rewrites);
            expect(result).toContain('file1.ts');
            expect(result).toContain('file2.ts');
            expect(result).toContain('--dry-run');
        });

        it('should include rewrite info when present', () => {
            const result = formatRemoveDryRunOutput('webapp', ['file1.ts'], [['config.json', '{}']]);
            expect(result).toContain('file1.ts');
            expect(result).toContain('Files to rewrite');
        });
    });

    describe('updateRemoveContracts', () => {
        it('should return early when contract does not exist', async () => {
            const service = {
                exists: (p: string) => p !== 'contracts/project-contracts.json',
            } as unknown as ScaffoldService;
            // Should not throw — just returns early
            await updateRemoveContracts(service, 'webapp');
        });

        it('should remove optional workspace from contract', async () => {
            const contract = {
                optionalWorkspaces: { 'apps/web': '@starter/web', 'apps/cli': '@starter/cli' },
                workspaceDependencyRules: {},
            };
            let written: unknown = null;
            const service = {
                exists: (_p: string) => true,
                readJson: () => contract,
                writeJson: (_path: string, data: unknown) => {
                    written = data;
                },
            } as unknown as ScaffoldService;

            await updateRemoveContracts(service, 'webapp');
            const optional = (written as Record<string, unknown>)?.optionalWorkspaces as Record<string, string>;
            expect(optional['apps/web']).toBeUndefined();
            expect(optional['apps/cli']).toBe('@starter/cli');
        });

        it('should remove dependency rules when feature has packages', async () => {
            // Set up a feature with packages that overlap with dependencyRules
            const origCli = SCAFFOLD_FEATURES.cli;
            SCAFFOLD_FEATURES.cli = { ...SCAFFOLD_FEATURES.cli, packages: ['@starter/cli'] } as typeof origCli;

            const contract = {
                optionalWorkspaces: { 'apps/cli': '@starter/cli' },
                workspaceDependencyRules: { '@starter/cli': ['@starter/core'] },
            };
            let written: unknown = null;
            const service = {
                exists: (_p: string) => true,
                readJson: () => contract,
                writeJson: (_path: string, data: unknown) => {
                    written = data;
                },
            } as unknown as ScaffoldService;

            await updateRemoveContracts(service, 'cli');
            const rules = (written as Record<string, unknown>)?.workspaceDependencyRules as Record<string, string[]>;
            expect(rules['@starter/cli']).toBeUndefined();

            SCAFFOLD_FEATURES.cli = origCli;
        });

        it('should return early for unknown feature', async () => {
            const service = {
                exists: (_p: string) => true,
                readJson: () => ({ optionalWorkspaces: {}, workspaceDependencyRules: {} }),
            } as unknown as ScaffoldService;
            // unknown feature has no workspacePath mapping → returns without writeJson
            await updateRemoveContracts(service, 'unknown-feature');
        });

        it('should not write when nothing modified', async () => {
            let writeCalled = false;
            const service = {
                exists: (_p: string) => true,
                readJson: () => ({ optionalWorkspaces: {}, workspaceDependencyRules: {} }),
                writeJson: () => {
                    writeCalled = true;
                },
            } as unknown as ScaffoldService;
            // `webapp` is in workspaceMap but not in optionalWorkspaces → nothing to delete
            await updateRemoveContracts(service, 'webapp');
            expect(writeCalled).toBe(false);
        });
    });

    describe('runPostRemoveScripts', () => {
        it('should run shell commands without warning on success', () => {
            const commands: string[][] = [];
            const service = {
                runShell: (cmd: string, args: string[]) => {
                    commands.push([cmd, ...args]);
                    return 0;
                },
            } as unknown as ScaffoldService;
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });

            runPostRemoveScripts(service, errStream);
            expect(commands.length).toBe(2);
            expect(warnings.length).toBe(0);
        });

        it('should warn on non-zero exit code', () => {
            const service = {
                runShell: () => 1,
            } as unknown as ScaffoldService;
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });

            runPostRemoveScripts(service, errStream);
            expect(warnings.length).toBe(2);
            expect(warnings[0]).toContain('Warning');
            expect(warnings[0]).toContain('bun install');
        });
    });

    describe('execute (integration)', () => {
        beforeEach(setup);
        afterEach(cleanup);

        it('should error on unknown feature', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'remove', 'nonexistent', '--json'], { from: 'user' });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.error).toContain('Unknown feature');
        });

        it('should error on required feature', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'remove', 'contracts', '--json'], { from: 'user' });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.error).toContain('Cannot remove required feature');
        });

        it('should block webapp removal in starter repo', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'remove', 'webapp', '--json'], { from: 'user' });
            const parsed = JSON.parse(output.join(''));
            // Starter repo blocks webapp removal via shouldBlockStarterWebappRemoval
            expect(parsed.error).toContain('Refusing');
        });

        it('should remove an installed optional feature', async () => {
            const dir = `${TEST_DIR}/remove`;
            mkdirSync(`${dir}/apps/server`, { recursive: true });
            mkdirSync(`${dir}/contracts`, { recursive: true });
            writeFileSync(`${dir}/apps/server/package.json`, '{}');
            writeFileSync(
                `${dir}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: { rootPackageName: '@t/test' },
                    requiredWorkspaces: {},
                    optionalWorkspaces: { 'apps/server': '@starter/server' },
                }),
            );
            const prev = getCwd();
            chdir(dir);
            try {
                const { stream, output } = createCollector();
                const errColl = createCollector();
                const { program } = buildTestProgram(stream, errColl.stream);
                await program.parseAsync(['scaffold', 'remove', 'server', '--json'], { from: 'user' });
                const parsed = JSON.parse(output.join(''));
                expect(parsed.success).toBe(true);
                expect(parsed.feature).toBe('server');
            } finally {
                chdir(prev);
            }
        });
    });
});
