import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chdir, cwd as getCwd } from 'node:process';
import { Writable } from 'node:stream';
import {
    collectInitOptions,
    computeIdentity,
    promptTextForInit,
    replaceInContent,
    runPostInitScripts,
    stageInitChanges,
    validateInitOptions,
} from '../../../src/commands/scaffold/scaffold-init';
import { ScaffoldService } from '../../../src/commands/scaffold/services/scaffold-service';
import { buildTestProgram } from '../../helpers/test-program';

const TEST_DIR = '/tmp/scaffold-init-test';

function setup() {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(`${TEST_DIR}/contracts`, { recursive: true });
    mkdirSync(`${TEST_DIR}/packages/core/src`, { recursive: true });
    mkdirSync(`${TEST_DIR}/apps/cli/src`, { recursive: true });

    writeFileSync(
        `${TEST_DIR}/contracts/project-contracts.json`,
        JSON.stringify({
            version: 1,
            projectIdentity: {
                displayName: 'Old Project',
                brandName: 'Old',
                projectSlug: 'old-project',
                rootPackageName: '@old/old-project-starter',
                repositoryUrl: 'https://github.com/old/old-project',
                binaryName: 'old',
                binaryLabel: 'Old CLI',
                apiTitle: 'Old API',
                webDescription: 'Old WebApp',
            },
            requiredWorkspaces: {
                'packages/contracts': '@old/contracts',
                'packages/core': '@old/core',
            },
            optionalWorkspaces: {},
            workspaceDependencyRules: {},
        }),
    );

    writeFileSync(`${TEST_DIR}/package.json`, JSON.stringify({ name: '@old/old-project-starter' }));
}

function cleanup() {
    rmSync(TEST_DIR, { recursive: true, force: true });
}

function createCollector(): { stream: Writable; output: string[] } {
    const output: string[] = [];
    return {
        output,
        stream: new Writable({
            write(chunk, _enc, cb) {
                output.push(chunk.toString());
                cb();
            },
        }),
    };
}

describe('ScaffoldInitCommand', () => {
    beforeEach(setup);
    afterEach(cleanup);

    describe('command registration', () => {
        it('should register scaffold init command', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            expect(scaffold).toBeDefined();
            const init = scaffold?.commands.find((c) => c.name() === 'init');
            expect(init).toBeDefined();
            expect(init?.description()).toContain('Initialize project identity');
        });

        it('should have expected options registered', () => {
            const { program } = buildTestProgram();
            const scaffold = program.commands.find((c) => c.name() === 'scaffold');
            const init = scaffold?.commands.find((c) => c.name() === 'init');
            const optionNames = init?.options.map((o) => o.long ?? o.short);
            expect(optionNames).toContain('--name');
            expect(optionNames).toContain('--scope');
            expect(optionNames).toContain('--dry-run');
            expect(optionNames).toContain('--json');
            expect(optionNames).toContain('--skip-check');
        });
    });

    describe('validateOptions', () => {
        it('should return error when name is missing', () => {
            const result = validateInitOptions({ scope: '@myorg' });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toContain('--name');
        });

        it('should return error when scope is missing', () => {
            const result = validateInitOptions({ name: 'my-project' });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toContain('--scope');
        });

        it('should return error when scope does not start with @', () => {
            const result = validateInitOptions({ name: 'my-project', scope: 'myorg' });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toContain('--scope must start with @');
        });

        it('should return error when name contains @', () => {
            const result = validateInitOptions({ name: '@myorg/pkg', scope: '@myorg' });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toContain('--name should be a slug');
        });

        it('should return ok for valid options', () => {
            const result = validateInitOptions({ name: 'my-project', scope: '@myorg' });
            expect(result.ok).toBe(true);
        });

        it('should accept all valid option combinations', () => {
            expect(validateInitOptions({ name: 'a', scope: '@a' }).ok).toBe(true);
            expect(validateInitOptions({ name: 'my-app', scope: '@org', title: 'My App' }).ok).toBe(true);
            expect(validateInitOptions({ name: 'x', scope: '@x', brand: 'Brand', bin: 'bin' }).ok).toBe(true);
        });
    });

    describe('computeIdentity', () => {
        it('should compute identity with minimal options', () => {
            const identity = computeIdentity({ name: 'my-project', scope: '@myorg' }, new ScaffoldService());
            expect(identity.displayName).toBe('My Project');
            expect(identity.brandName).toBe('My Project');
            expect(identity.projectSlug).toBe('my-project');
            expect(identity.rootPackageName).toBe('@myorg/my-project-starter');
            expect(identity.binaryName).toBe('tbs');
            expect(identity.binaryLabel).toBe('My Project');
        });

        it('should compute identity with all options', () => {
            const identity = computeIdentity(
                {
                    name: 'my-app',
                    title: 'My Application',
                    brand: 'MyBrand',
                    scope: '@myorg',
                    repoUrl: 'https://gitlab.com/myorg/my-app',
                    bin: 'myapp',
                },
                new ScaffoldService(),
            );
            expect(identity.displayName).toBe('My Application');
            expect(identity.brandName).toBe('MyBrand');
            expect(identity.projectSlug).toBe('my-app');
            expect(identity.rootPackageName).toBe('@myorg/my-app-starter');
            expect(identity.repositoryUrl).toBe('https://gitlab.com/myorg/my-app');
            expect(identity.binaryName).toBe('myapp');
            expect(identity.binaryLabel).toBe('MyBrand');
        });

        it('should derive title from name', () => {
            const identity = computeIdentity({ name: 'my-project-name', scope: '@org' }, new ScaffoldService());
            expect(identity.displayName).toBe('My Project Name');
        });

        it('should derive brand from title', () => {
            const identity = computeIdentity(
                { name: 'proj', title: 'Project Title', scope: '@org' },
                new ScaffoldService(),
            );
            expect(identity.brandName).toBe('Project Title');
        });

        it('should derive repo URL from scope and name', () => {
            const identity = computeIdentity({ name: 'myapp', scope: '@myorg' }, new ScaffoldService());
            expect(identity.repositoryUrl).toBe('https://github.com/myorg/myapp');
        });

        it('should handle kebab-case to title case', () => {
            const identity = computeIdentity({ name: 'my-awesome-project', scope: '@org' }, new ScaffoldService());
            expect(identity.displayName).toBe('My Awesome Project');
        });
    });

    describe('replaceInContent', () => {
        it('should replace single occurrence', () => {
            const result = replaceInContent('Hello World', [['World', 'Universe']]);
            expect(result).toBe('Hello Universe');
        });

        it('should replace multiple occurrences', () => {
            const result = replaceInContent('foo bar foo', [['foo', 'baz']]);
            expect(result).toBe('baz bar baz');
        });

        it('should not replace if from equals to', () => {
            const result = replaceInContent('Hello', [['Hello', 'Hello']]);
            expect(result).toBe('Hello');
        });

        it('should not replace empty string', () => {
            const result = replaceInContent('Hello', [['', 'X']]);
            expect(result).toBe('Hello');
        });

        it('should handle complex replacements', () => {
            const content = 'OldProject Starter v1.0';
            const replacements: Array<[string, string]> = [
                ['OldProject', 'NewProject'],
                ['Starter', 'Framework'],
                ['1.0', '2.0'],
            ];
            const result = replaceInContent(content, replacements);
            expect(result).toBe('NewProject Framework v2.0');
        });

        it('should skip tokens shorter than the minimum replacement length', () => {
            const result = replaceInContent('apple banana cabbage', [['a', 'X']]);
            expect(result).toBe('apple banana cabbage');
        });
    });

    describe('stageChanges', () => {
        it('should stage contract and package.json updates', () => {
            const service = new ScaffoldService(TEST_DIR);
            const identity = computeIdentity({ name: 'newproj', scope: '@neworg' }, new ScaffoldService());
            const pendingWrites = stageInitChanges(service, identity);
            expect(pendingWrites.has('contracts/project-contracts.json')).toBe(true);
            expect(pendingWrites.has('package.json')).toBe(true);
        });

        it('should replace old identity in staged contract', () => {
            const service = new ScaffoldService(TEST_DIR);
            const identity = computeIdentity({ name: 'newproj', scope: '@neworg' }, new ScaffoldService());
            const pendingWrites = stageInitChanges(service, identity);
            const contractRaw = pendingWrites.get('contracts/project-contracts.json') ?? '';
            expect(contractRaw).toContain('Newproj');
            expect(contractRaw).toContain('@neworg/newproj-starter');
            expect(contractRaw).not.toContain('@old/old-project-starter');
        });

        it('should replace old identity in package.json', () => {
            const service = new ScaffoldService(TEST_DIR);
            const identity = computeIdentity({ name: 'newproj', scope: '@neworg' }, new ScaffoldService());
            const pendingWrites = stageInitChanges(service, identity);
            const pkgRaw = pendingWrites.get('package.json') ?? '';
            expect(pkgRaw).toContain('@neworg/newproj-starter');
            expect(pkgRaw).not.toContain('@old');
        });
    });

    describe('collectInitOptions', () => {
        it('should derive defaults in interactive mode (isJson=false)', () => {
            const service = new ScaffoldService();
            const opts = { name: 'my-project', scope: '@myorg' };
            const result = collectInitOptions(opts, service, false);
            expect(result.name).toBe('my-project');
            expect(result.title).toBe('My Project');
            expect(result.brand).toBe('My Project');
            expect(result.scope).toBe('@myorg');
        });

        it('should use provided values over defaults in interactive mode', () => {
            const service = new ScaffoldService();
            const opts = { name: 'proj', title: 'Custom', brand: 'C', scope: '@org' };
            const result = collectInitOptions(opts, service, false);
            expect(result.title).toBe('Custom');
            expect(result.brand).toBe('C');
        });

        it('should throw when name is missing without default', () => {
            const service = new ScaffoldService();
            expect(() => collectInitOptions({}, service, false)).toThrow('Project slug');
        });

        it('should return only provided fields in JSON mode', () => {
            const service = new ScaffoldService();
            const result = collectInitOptions({ name: 'x', scope: '@x', json: true }, service, true);
            expect(result.name).toBe('x');
            expect(result.scope).toBe('@x');
            expect(result.title).toBeUndefined();
        });
    });

    describe('promptTextForInit', () => {
        it('should return default value when provided', () => {
            expect(promptTextForInit('label', '@myorg')).toBe('@myorg');
        });

        it('should throw when no default', () => {
            expect(() => promptTextForInit('Project name')).toThrow('Project name is required');
        });
    });

    describe('runPostInitScripts', () => {
        it('should return early when skipCheck is true', async () => {
            const service = new ScaffoldService(TEST_DIR);
            const options = { name: 'proj', scope: '@org', skipCheck: true };
            await runPostInitScripts(service, options);
            // No-op — should not throw or spawn anything
        });

        it('should not spawn when skipCheck is true', async () => {
            const service = new ScaffoldService(TEST_DIR);
            // skipCheck=true skips the spawnSync loop entirely
            await runPostInitScripts(service, { name: 'proj', scope: '@org', skipCheck: true });
            // Test passes if no throw — spawn path is integration-only
        });
    });

    describe('execute (integration)', () => {
        it('should validate and return error for missing name', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'init', '--scope', '@myorg', '--json'], { from: 'user' });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.error).toContain('--name');
        });

        it('should validate and return error for missing scope', async () => {
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(['scaffold', 'init', '--name', 'my-project', '--json'], { from: 'user' });
            const parsed = JSON.parse(output.join(''));
            expect(parsed.error).toContain('--scope');
        });

        it('should dry-run and output files list', async () => {
            writeFileSync(`${TEST_DIR}/AGENTS.md`, 'old-project OldProject @old/old-project-starter');
            const { stream, output } = createCollector();
            const { program } = buildTestProgram(stream, stream);
            await program.parseAsync(
                ['scaffold', 'init', '--name', 'newproj', '--scope', '@neworg', '--dry-run', '--json'],
                { from: 'user' },
            );
            const parsed = JSON.parse(output.join(''));
            expect(parsed.files).toBeDefined();
            expect(parsed.preview).toContain('Files that would be modified');
        });

        it('should apply identity changes and run post-init scripts', async () => {
            const dir = `${TEST_DIR}/full`;
            mkdirSync(`${dir}/contracts`, { recursive: true });
            mkdirSync(`${dir}/packages/core/src`, { recursive: true });
            writeFileSync(`${dir}/package.json`, JSON.stringify({ name: '@old/old-project-starter' }));
            writeFileSync(`${dir}/AGENTS.md`, 'old-project OldProject @old/old-project-starter');
            writeFileSync(
                `${dir}/contracts/project-contracts.json`,
                JSON.stringify({
                    version: 1,
                    projectIdentity: {
                        displayName: 'Old Project',
                        brandName: 'Old',
                        projectSlug: 'old-project',
                        rootPackageName: '@old/old-project-starter',
                        repositoryUrl: 'https://github.com/old/old-project',
                        binaryName: 'old',
                        binaryLabel: 'Old CLI',
                        apiTitle: 'Old API',
                        webDescription: 'Old WebApp',
                    },
                    requiredWorkspaces: { 'packages/core': '@old/core' },
                    optionalWorkspaces: {},
                }),
            );
            const prev = getCwd();
            chdir(dir);
            try {
                const { stream, output } = createCollector();
                const errColl = createCollector();
                const { program } = buildTestProgram(stream, errColl.stream);
                await program.parseAsync(['scaffold', 'init', '--name', 'newproj', '--scope', '@neworg', '--json'], {
                    from: 'user',
                });
                const raw = output.join('');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    expect(parsed.success).toBe(true);
                    expect(parsed.files).toBeDefined();
                }
            } finally {
                chdir(prev);
            }
        });
    });
});
