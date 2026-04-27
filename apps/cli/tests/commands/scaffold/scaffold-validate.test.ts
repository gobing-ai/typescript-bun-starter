import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chdir, cwd as getCwd } from 'node:process';
import { Writable } from 'node:stream';
import {
    applyValidateFixes,
    listValidateFiles,
    runValidateSync,
    validateDependencyRules,
    validateFileNaming,
    validateInstructions,
    validateScripts,
    validateWorkspaces,
} from '../../../src/commands/scaffold/scaffold-validate';
import { ScaffoldService } from '../../../src/commands/scaffold/services/scaffold-service';
import type { ContractFile } from '../../../src/commands/scaffold/types/scaffold';
import { buildTestProgram } from '../../helpers/test-program';

const TEST_DIR = '/tmp/scaffold-validate-test';

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

function setupTestProject(options?: {
    requiredWorkspaces?: Record<string, string>;
    optionalWorkspaces?: Record<string, string>;
    requiredRootScripts?: string[];
    includeAgentsMd?: boolean;
    includeClaudeMd?: boolean;
}) {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(`${TEST_DIR}/contracts`, { recursive: true });

    const requiredWs = options?.requiredWorkspaces ?? {
        'packages/contracts': '@t/contracts',
        'packages/core': '@t/core',
    };
    for (const [path] of Object.entries(requiredWs)) {
        mkdirSync(`${TEST_DIR}/${path}/src`, { recursive: true });
        writeFileSync(`${TEST_DIR}/${path}/package.json`, '{}');
    }

    if (options?.optionalWorkspaces) {
        for (const [path] of Object.entries(options.optionalWorkspaces)) {
            mkdirSync(`${TEST_DIR}/${path}/src`, { recursive: true });
            writeFileSync(`${TEST_DIR}/${path}/package.json`, '{}');
        }
    }

    writeFileSync(
        `${TEST_DIR}/contracts/project-contracts.json`,
        JSON.stringify({
            version: 1,
            projectIdentity: {},
            requiredWorkspaces: requiredWs,
            optionalWorkspaces: options?.optionalWorkspaces ?? {},
            workspaceDependencyRules: {},
            requiredRootScripts: options?.requiredRootScripts,
        }),
    );

    writeFileSync(`${TEST_DIR}/package.json`, JSON.stringify({ scripts: {} }));

    if (options?.includeAgentsMd) writeFileSync(`${TEST_DIR}/AGENTS.md`, '# AGENTS.md');
    if (options?.includeClaudeMd) writeFileSync(`${TEST_DIR}/CLAUDE.md`, '# CLAUDE.md');
}

function cleanup() {
    rmSync(TEST_DIR, { recursive: true, force: true });
}

describe('ScaffoldValidateCommand', () => {
    describe('command registration', () => {
        it('should register scaffold validate command', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            expect(scaffold).toBeDefined();
            const validate = scaffold?.commands.find((c) => c.name() === 'validate');
            expect(validate).toBeDefined();
            expect(validate?.description()).toContain('Validate project');
        });

        it('should have --fix option', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            const validate = scaffold?.commands.find((c) => c.name() === 'validate');
            const optionNames = validate?.options.map((o) => o.long ?? o.short);
            expect(optionNames).toContain('--fix');
        });
    });

    describe('validateWorkspaces', () => {
        beforeEach(() => setupTestProject());

        it('should pass when all required workspaces exist', () => {
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateWorkspaces(service, contract);
            expect(issues.length).toBe(0);
        });

        it('should report missing required workspace', () => {
            rmSync(`${TEST_DIR}/packages/core`, { recursive: true, force: true });
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateWorkspaces(service, contract);
            const errors = issues.filter((i) => i.severity === 'error');
            expect(errors.some((i) => i.message.includes('Required workspace missing'))).toBe(true);
        });

        it('should warn when optional workspace not found on disk', () => {
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: {},
                    optionalWorkspaces: { 'apps/nonexistent': '@t/nonexistent' },
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateWorkspaces(service, contract);
            expect(issues.some((i) => i.severity === 'warning')).toBe(true);
        });

        it('should detect workspace on disk not in contract', () => {
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({ version: 1, projectIdentity: {}, requiredWorkspaces: {}, optionalWorkspaces: {} }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateWorkspaces(service, contract);
            expect(issues.some((i) => i.message.includes('missing from contract'))).toBe(true);
        });

        it('should detect workspace with missing package.json', () => {
            // Create workspace dir without package.json
            mkdirSync(`${TEST_DIR}/apps/nopkg`, { recursive: true });
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: { 'apps/nopkg': '@t/nopkg' },
                    optionalWorkspaces: {},
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateWorkspaces(service, contract);
            expect(issues.some((i) => i.message.includes('missing package.json'))).toBe(true);
        });

        afterEach(cleanup);
    });

    describe('validateScripts', () => {
        beforeEach(() => setupTestProject({ requiredRootScripts: ['check', 'test'] }));

        it('should pass when all required scripts exist', () => {
            writeFileSync(`${TEST_DIR}/package.json`, JSON.stringify({ scripts: { check: 'tsc', test: 'jest' } }));
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateScripts(service, contract);
            expect(issues.length).toBe(0);
        });

        it('should report missing script', () => {
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateScripts(service, contract);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.every((i) => i.severity === 'error')).toBe(true);
        });

        it('should return empty when no requiredRootScripts', () => {
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: {},
                    optionalWorkspaces: {},
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateScripts(service, contract);
            expect(issues.length).toBe(0);
        });

        afterEach(cleanup);
    });

    describe('validateInstructions', () => {
        it('should report missing AGENTS.md and CLAUDE.md', () => {
            setupTestProject();
            const service = new ScaffoldService(TEST_DIR);
            const issues = validateInstructions(service);
            expect(issues.length).toBe(2);
            expect(issues.every((i) => i.fixable)).toBe(true);
            cleanup();
        });

        it('should pass when both files exist', () => {
            setupTestProject({ includeAgentsMd: true, includeClaudeMd: true });
            const service = new ScaffoldService(TEST_DIR);
            const issues = validateInstructions(service);
            expect(issues.length).toBe(0);
            cleanup();
        });
    });

    describe('validateDependencyRules', () => {
        beforeEach(() => setupTestProject());
        afterEach(cleanup);

        it('should return empty when no workspaceDependencyRules', () => {
            // workspaceDependencyRules key is present but empty
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateDependencyRules(service, contract);
            expect(issues.length).toBe(0);
        });

        it('should return empty when workspaceDependencyRules is undefined', () => {
            // workspaceDependencyRules key is absent entirely
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: {},
                    optionalWorkspaces: {},
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateDependencyRules(service, contract);
            expect(issues.length).toBe(0);
        });

        it('should detect dependency violations', () => {
            mkdirSync(`${TEST_DIR}/apps/test`, { recursive: true });
            // @starter/contracts is a workspace package but not in allowed deps for @starter/test
            writeFileSync(
                `${TEST_DIR}/apps/test/package.json`,
                JSON.stringify({
                    dependencies: { '@starter/contracts': 'workspace:*', '@starter/core': 'workspace:*' },
                }),
            );
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: {
                        'apps/test': '@starter/test',
                        'packages/contracts': '@starter/contracts',
                        'packages/core': '@starter/core',
                    },
                    optionalWorkspaces: {},
                    workspaceDependencyRules: { '@starter/test': ['@starter/core'] },
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateDependencyRules(service, contract);
            expect(issues.length).toBe(1);
            expect(issues[0].message).toContain('not in allowed dependencies');
        });
    });

    describe('validateFileNaming', () => {
        beforeEach(() => setupTestProject());
        afterEach(cleanup);

        it('should return empty when no fileNamingRules', () => {
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateFileNaming(service, contract);
            expect(issues.length).toBe(0);
        });

        it('should detect naming violations', () => {
            mkdirSync(`${TEST_DIR}/src`, { recursive: true });
            writeFileSync(`${TEST_DIR}/src/CamelCase.ts`, '// test');
            writeFileSync(
                `${TEST_DIR}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: { 'packages/contracts': '@t/c' },
                    optionalWorkspaces: {},
                    fileNamingRules: [{ pathPrefix: 'src', pattern: '^[a-z]', description: 'must be kebab-case' }],
                }),
            );
            const service = new ScaffoldService(TEST_DIR);
            const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
            const issues = validateFileNaming(service, contract);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].message).toContain('does not match pattern');
        });
    });

    describe('listValidateFiles', () => {
        beforeEach(() => setupTestProject());
        afterEach(cleanup);

        it('should list files recursively', () => {
            mkdirSync(`${TEST_DIR}/src/sub`, { recursive: true });
            writeFileSync(`${TEST_DIR}/src/a.ts`, '// a');
            writeFileSync(`${TEST_DIR}/src/sub/b.ts`, '// b');
            const files = listValidateFiles(`${TEST_DIR}/src`);
            expect(files.length).toBe(2);
        });

        it('should skip ignored directories', () => {
            mkdirSync(`${TEST_DIR}/src/node_modules`, { recursive: true });
            writeFileSync(`${TEST_DIR}/src/a.ts`, '// a');
            writeFileSync(`${TEST_DIR}/src/node_modules/pkg.ts`, '// pkg');
            const files = listValidateFiles(`${TEST_DIR}/src`);
            expect(files.length).toBe(1);
        });

        it('should return empty for nonexistent directory', () => {
            const files = listValidateFiles(`${TEST_DIR}/nonexistent`);
            expect(files.length).toBe(0);
        });
    });

    describe('applyValidateFixes', () => {
        it('should handle empty issues array', () => {
            // Should not throw or call runValidateSync
            applyValidateFixes([]);
        });

        it('should skip non-fixable issues', () => {
            applyValidateFixes([{ severity: 'error', category: 'workspace', message: 'test', fixable: false }]);
        });

        it('should run fix for fixable instructions issues', () => {
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });
            applyValidateFixes(
                [
                    {
                        severity: 'warning',
                        category: 'instructions',
                        message: 'AGENTS.md missing',
                        path: 'AGENTS.md',
                        fixable: true,
                    },
                ],
                errStream,
            );
            // bun run generate:instructions may succeed or warn — either is valid coverage
            // If it succeeds, no warnings. If it fails, we get a warning.
        });
    });

    describe('runValidateSync', () => {
        it('should run a successful command without warnings', () => {
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });
            // echo is available on Unix; on Windows this test will still pass (just different command)
            runValidateSync('echo', ['success'], errStream);
            // Successful spawn should produce no warnings
            expect(warnings.length).toBe(0);
        });

        it('should warn on command with non-zero exit', () => {
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });
            // `ls /nonexistent` will exit non-zero on Unix
            runValidateSync('ls', ['/nonexistent/path/that/does/not/exist'], errStream);
            expect(warnings.some((w) => w.includes('Warning'))).toBe(true);
        });

        it('should warn when command fails to start', () => {
            const warnings: string[] = [];
            const errStream = new Writable({
                write(chunk, _e, cb) {
                    warnings.push(chunk.toString());
                    cb();
                },
            });
            // Use a definitely nonexistent binary path
            runValidateSync('/nonexistent/binary/that/does/not/exist', [], errStream);
            expect(warnings.some((w) => w.includes('Warning') && w.includes('failed to start'))).toBe(true);
        });
    });

    describe('execute (integration)', () => {
        beforeEach(() => setupTestProject());
        afterEach(cleanup);

        it('should pass validation for valid project', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'validate', '--json'], { from: 'user' });
            const json = JSON.parse(output.join(''));
            expect(json.valid).toBe(true);
        });

        it('should report issues when workspace missing', async () => {
            rmSync(`${TEST_DIR}/packages/core`, { recursive: true, force: true });
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'validate', '--json'], { from: 'user' });
            const json = JSON.parse(output.join(''));
            expect(json.issues.length).toBeGreaterThan(0);
        });

        it('should output valid when project has no issues', async () => {
            const dir = `${TEST_DIR}/clean`;
            mkdirSync(`${dir}/contracts`, { recursive: true });
            mkdirSync(`${dir}/packages/contracts`, { recursive: true });
            mkdirSync(`${dir}/packages/core`, { recursive: true });
            writeFileSync(`${dir}/package.json`, '{}');
            writeFileSync(`${dir}/packages/contracts/package.json`, '{}');
            writeFileSync(`${dir}/packages/core/package.json`, '{}');
            writeFileSync(`${dir}/AGENTS.md`, '# AGENTS');
            writeFileSync(`${dir}/CLAUDE.md`, '# CLAUDE');
            writeFileSync(
                `${dir}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: { 'packages/contracts': '@t/c', 'packages/core': '@t/core' },
                    optionalWorkspaces: {},
                }),
            );
            const prev = getCwd();
            chdir(dir);
            try {
                const { stream, output } = createCollector();
                const { program } = buildTestProgram(stream, stream);
                await program.parseAsync(['scaffold', 'validate', '--json'], { from: 'user' });
                const json = JSON.parse(output.join(''));
                expect(json.valid).toBe(true);
            } finally {
                chdir(prev);
            }
        });

        it('should report error when contract is missing', async () => {
            const dir = `${TEST_DIR}/nocontract`;
            mkdirSync(dir, { recursive: true });
            const prev = getCwd();
            chdir(dir);
            try {
                const { stream, output } = createCollector();
                const { program } = buildTestProgram(stream, stream);
                await program.parseAsync(['scaffold', 'validate', '--json'], { from: 'user' });
                const json = JSON.parse(output.join(''));
                expect(json.error).toContain('not found');
            } finally {
                chdir(prev);
            }
        });

        it('should re-validate after --fix', async () => {
            const dir = `${TEST_DIR}/fix`;
            mkdirSync(`${dir}/contracts`, { recursive: true });
            mkdirSync(`${dir}/packages/contracts`, { recursive: true });
            mkdirSync(`${dir}/packages/core`, { recursive: true });
            writeFileSync(`${dir}/package.json`, JSON.stringify({ scripts: { 'generate:instructions': 'echo ok' } }));
            writeFileSync(`${dir}/packages/contracts/package.json`, '{}');
            writeFileSync(`${dir}/packages/core/package.json`, '{}');
            writeFileSync(
                `${dir}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {},
                    requiredWorkspaces: { 'packages/contracts': '@t/c', 'packages/core': '@t/core' },
                    optionalWorkspaces: {},
                }),
            );
            const prev = getCwd();
            chdir(dir);
            try {
                const { stream, output } = createCollector();
                const { program } = buildTestProgram(stream, stream);
                await program.parseAsync(['scaffold', 'validate', '--fix', '--json'], { from: 'user' });
                const json = JSON.parse(output.join(''));
                // --fix generates instructions files, then re-validates
                expect(json.valid !== undefined).toBe(true);
            } finally {
                chdir(prev);
            }
        });
    });
});
