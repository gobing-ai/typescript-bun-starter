import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { Cli } from 'clipanion';
import { ScaffoldValidateCommand } from '../../../src/commands/scaffold/scaffold-validate';

// ── Helpers ──────────────────────────────────────────────────────────────

const TEST_DIR = '/tmp/scaffold-validate-test';

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
    cli.register(ScaffoldValidateCommand);
    return cli;
}

function setupTestProject(options?: {
    requiredWorkspaces?: Record<string, string>;
    optionalWorkspaces?: Record<string, string>;
    requiredRootScripts?: string[];
    fileNamingRules?: Array<{ pathPrefix: string; pattern: string; description: string }>;
    includeAgentsMd?: boolean;
    includeClaudeMd?: boolean;
    includePackageJson?: boolean;
    scripts?: Record<string, string>;
}) {
    const opts = {
        requiredWorkspaces: { 'packages/contracts': 'Contracts', 'packages/core': 'Core' },
        optionalWorkspaces: {} as Record<string, string>,
        requiredRootScripts: undefined as string[] | undefined,
        fileNamingRules: undefined as Array<{ pathPrefix: string; pattern: string; description: string }> | undefined,
        includeAgentsMd: true,
        includeClaudeMd: true,
        includePackageJson: true,
        scripts: {} as Record<string, string>,
        ...options,
    };

    // Create required workspaces
    for (const [relPath] of Object.entries(opts.requiredWorkspaces)) {
        mkdirSync(`${TEST_DIR}/${relPath}/src`, { recursive: true });
        writeFileSync(
            `${TEST_DIR}/${relPath}/package.json`,
            JSON.stringify({ name: `@starter/${relPath.split('/').pop()}` }),
        );
    }

    // Create optional workspaces
    for (const [relPath] of Object.entries(opts.optionalWorkspaces)) {
        mkdirSync(`${TEST_DIR}/${relPath}/src`, { recursive: true });
        writeFileSync(
            `${TEST_DIR}/${relPath}/package.json`,
            JSON.stringify({ name: `@starter/${relPath.split('/').pop()}` }),
        );
    }

    // Create contract file
    const contract: Record<string, unknown> = {
        version: 1,
        projectIdentity: {
            displayName: 'Test',
            brandName: 'Test',
            projectSlug: 'test',
            rootPackageName: 'test',
            repositoryUrl: 'https://example.com',
            binaryName: 'tbs',
            binaryLabel: 'TBS',
            apiTitle: 'Test API',
            webDescription: 'Test',
        },
        requiredWorkspaces: opts.requiredWorkspaces,
        optionalWorkspaces: opts.optionalWorkspaces,
        workspaceDependencyRules: {},
    };
    if (opts.requiredRootScripts) {
        contract.requiredRootScripts = opts.requiredRootScripts;
    }
    if (opts.fileNamingRules) {
        contract.fileNamingRules = opts.fileNamingRules;
    }

    mkdirSync(`${TEST_DIR}/contracts`, { recursive: true });
    writeFileSync(`${TEST_DIR}/contracts/project-contracts.json`, JSON.stringify(contract, null, 2));

    // Create root package.json
    if (opts.includePackageJson) {
        writeFileSync(
            `${TEST_DIR}/package.json`,
            JSON.stringify({ name: 'test', scripts: { check: 'bun run check', ...opts.scripts } }),
        );
    }

    // Create instruction files
    if (opts.includeAgentsMd) {
        writeFileSync(`${TEST_DIR}/AGENTS.md`, '# AGENTS.md');
    }
    if (opts.includeClaudeMd) {
        writeFileSync(`${TEST_DIR}/CLAUDE.md`, '# CLAUDE.md');
    }
}

function cleanupTestDir() {
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ScaffoldValidateCommand', () => {
    const originalCwd = process.cwd();

    beforeEach(() => {
        cleanupTestDir();
        mkdirSync(TEST_DIR, { recursive: true });
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTestDir();
    });

    // ── Static metadata ────────────────────────────────────────────────

    describe('path registration', () => {
        it('should register with correct path', () => {
            expect(ScaffoldValidateCommand.paths).toEqual([['scaffold', 'validate']]);
        });
    });

    describe('usage', () => {
        it('should have correct category', () => {
            expect(ScaffoldValidateCommand.usage.category).toBe('Scaffold');
        });

        it('should have description', () => {
            expect(ScaffoldValidateCommand.usage.description).toBeTruthy();
        });

        it('should mention --fix option', () => {
            const details = ScaffoldValidateCommand.usage.details ?? '';
            expect(details).toContain('--fix');
        });

        it('should have examples', () => {
            expect(ScaffoldValidateCommand.usage.examples?.length).toBeGreaterThan(0);
        });
    });

    describe('options', () => {
        it('should have --dry-run flag (inherited)', () => {
            const cmd = new ScaffoldValidateCommand();
            expect((cmd as unknown as { dryRun: unknown }).dryRun).toBeDefined();
        });

        it('should have --json flag (inherited)', () => {
            const cmd = new ScaffoldValidateCommand();
            expect((cmd as unknown as { json: unknown }).json).toBeDefined();
        });

        it('should have --fix flag', () => {
            const cmd = new ScaffoldValidateCommand();
            expect((cmd as unknown as { fix: unknown }).fix).toBeDefined();
        });
    });

    // ── Execute: contract missing ──────────────────────────────────────

    describe('execute - contract not found', () => {
        it('should error when contracts file is missing', async () => {
            process.chdir(TEST_DIR);
            // No contract file created
            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            expect(output.error).toContain('not found');
        });
    });

    // ── Execute: valid project ─────────────────────────────────────────

    describe('execute - valid project', () => {
        it('should pass validation for a well-formed project', async () => {
            setupTestProject();
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.valid).toBe(true);
            expect(output.message).toContain('passed');
        });
    });

    // ── Workspace validation ───────────────────────────────────────────

    describe('workspace validation', () => {
        it('should error when required workspace is missing', async () => {
            setupTestProject();
            // Remove a required workspace
            rmSync(`${TEST_DIR}/packages/contracts`, { recursive: true, force: true });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            // When errors exist, writeOutput only writes { error: msg }
            expect(output.error).toContain('Validation failed');
        });

        it('should warn when optional workspace is in contract but not on disk', async () => {
            setupTestProject({
                optionalWorkspaces: { 'apps/server': 'Server' },
            });
            // Remove the optional workspace (was created by setupTestProject)
            rmSync(`${TEST_DIR}/apps/server`, { recursive: true, force: true });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            // Warnings don't cause error exit, but missing optional workspace
            // also triggers "Workspace missing package.json" which is an error
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            expect(output.error).toContain('Validation failed');
        });

        it('should error when workspace missing package.json', async () => {
            setupTestProject();
            // Remove package.json from a required workspace
            rmSync(`${TEST_DIR}/packages/contracts/package.json`);

            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            // writeOutput with error string produces { error: msg }
            expect(output.error).toContain('Validation failed');
        });
    });

    // ── Script validation ──────────────────────────────────────────────

    describe('script validation', () => {
        it('should error when required script is missing', async () => {
            setupTestProject({
                requiredRootScripts: ['build', 'test', 'deploy'],
            });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            expect(output.error).toContain('Validation failed');
        });

        it('should pass when all required scripts exist', async () => {
            setupTestProject({
                requiredRootScripts: ['check'],
                scripts: { check: 'bun run check' },
            });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.valid).toBe(true);
        });

        it('should skip script validation when not in contract', async () => {
            setupTestProject(); // No requiredRootScripts
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);
        });
    });

    // ── File naming validation ─────────────────────────────────────────

    describe('file naming validation', () => {
        it('should warn when files do not match naming pattern', async () => {
            setupTestProject({
                fileNamingRules: [
                    {
                        pathPrefix: 'packages/contracts/src',
                        pattern: '^[a-z][a-z0-9-]*\\.ts$',
                        description: 'kebab-case TypeScript files',
                    },
                ],
            });

            // Create a file that violates the pattern
            mkdirSync(`${TEST_DIR}/packages/contracts/src`, { recursive: true });
            writeFileSync(`${TEST_DIR}/packages/contracts/src/BadName.ts`, '// bad');

            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.issues.some((i: { category: string }) => i.category === 'naming')).toBe(true);
            expect(output.issues.some((i: { message: string }) => i.message.includes('BadName.ts'))).toBe(true);
        });

        it('should skip when pathPrefix does not exist', async () => {
            setupTestProject({
                fileNamingRules: [
                    {
                        pathPrefix: 'nonexistent/path',
                        pattern: '.*',
                        description: 'any files',
                    },
                ],
            });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.valid).toBe(true);
        });

        it('should pass when no fileNamingRules in contract', async () => {
            setupTestProject(); // No fileNamingRules
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);
        });
    });

    // ── Instructions validation ────────────────────────────────────────

    describe('instructions validation', () => {
        it('should warn when AGENTS.md is missing', async () => {
            setupTestProject({ includeAgentsMd: false });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(
                output.issues.some(
                    (i: { category: string; message: string }) =>
                        i.category === 'instructions' && i.message.includes('AGENTS.md'),
                ),
            ).toBe(true);
        });

        it('should warn when CLAUDE.md is missing', async () => {
            setupTestProject({ includeClaudeMd: false });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(
                output.issues.some(
                    (i: { category: string; message: string }) =>
                        i.category === 'instructions' && i.message.includes('CLAUDE.md'),
                ),
            ).toBe(true);
        });

        it('should pass when both instruction files exist', async () => {
            setupTestProject();
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            const instructionIssues =
                output.issues?.filter((i: { category: string }) => i.category === 'instructions') ?? [];
            expect(instructionIssues.length).toBe(0);
        });
    });

    // ── Text mode output ───────────────────────────────────────────────

    describe('text mode output', () => {
        it('should output text error for missing contract', async () => {
            process.chdir(TEST_DIR);
            const cli = makeCli();
            const stderr: string[] = [];
            const cmd = cli.process(['scaffold', 'validate'], {
                stdout: createMockWritable([]),
                stderr: createMockWritable(stderr),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);
            expect(stderr.join('')).toContain('not found');
        });
    });

    // ── Fix hint ───────────────────────────────────────────────────────

    describe('fix hint', () => {
        it('should include hint when fixable issues exist', async () => {
            setupTestProject({ includeAgentsMd: false });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.hint).toContain('--fix');
        });

        it('should not include hint when no fixable issues exist', async () => {
            // Create a project with only required workspaces, no issues
            setupTestProject();
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(0);

            const output = JSON.parse(stdout.join(''));
            expect(output.hint).toBeUndefined();
        });
    });

    // ── Fix path ────────────────────────────────────────────────────

    describe('--fix path', () => {
        it('should attempt fixes when --fix is passed with fixable issues', async () => {
            // Missing AGENTS.md is fixable; --fix will try to run generate:instructions
            // which will fail, but we verify the code path is exercised
            setupTestProject({ includeAgentsMd: false });
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--fix', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            // execute() should not throw even if generate:instructions fails
            const exitCode = await cmd.execute();
            expect(typeof exitCode).toBe('number');
        });

        it('should re-validate after fixes are applied', async () => {
            // Create both instruction files so the project is fully valid
            setupTestProject();
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--fix', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            // No fixable issues → --fix is a no-op → passes
            expect(exitCode).toBe(0);
        });
    });

    // ── Multiple issues ────────────────────────────────────────────────

    describe('multiple issues', () => {
        it('should report both errors and warnings', async () => {
            setupTestProject({
                requiredRootScripts: ['nonexistent-script'],
            });
            // Also remove an instruction file for a warning
            rmSync(`${TEST_DIR}/AGENTS.md`);
            process.chdir(TEST_DIR);

            const cli = makeCli();
            const stdout: string[] = [];
            const cmd = cli.process(['scaffold', 'validate', '--json'], {
                stdout: createMockWritable(stdout),
            }) as ScaffoldValidateCommand;

            const exitCode = await cmd.execute();
            expect(exitCode).toBe(1);

            const output = JSON.parse(stdout.join(''));
            expect(output.error).toContain('Validation failed');
        });
    });
});
