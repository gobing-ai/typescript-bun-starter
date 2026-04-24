import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    buildRegexFlags,
    computeSummary,
    discoverFiles,
    executeFix,
    executePolicies,
    executePolicy,
    executeRewriteFix,
    executeRg,
    extractExecError,
    formatFixResult,
    formatViolation,
    globFiles,
    isNoMatchError,
    loadPolicy,
    main,
    matchesAnyPattern,
    matchesGlob,
    normalizePath,
    parseArgs,
    printJson,
    printReport,
    printUsage,
    splitCommand,
    toDisplayPath,
    toRelativePath,
    validatePolicy,
} from './policy-check';

const tempDirs: string[] = [];
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalStdoutIsTTY = process.stdout.isTTY;

function captureOutput<T>(fn: () => T): { result: T; stdout: string; stderr: string } {
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout.push(String(chunk));
        return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;

    try {
        return {
            result: fn(),
            stdout: stdout.join(''),
            stderr: stderr.join(''),
        };
    } finally {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
    }
}

async function captureOutputAsync<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout.push(String(chunk));
        return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;

    try {
        return {
            result: await fn(),
            stdout: stdout.join(''),
            stderr: stderr.join(''),
        };
    } finally {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
    }
}

function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'policy-check-'));
    tempDirs.push(dir);
    return dir;
}

function writeJson(path: string, value: unknown): void {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
}

afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: originalStdoutIsTTY,
    });

    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('validatePolicy', () => {
    test('loads a valid policy file from disk', () => {
        const cwd = makeTempDir();
        const path = join(cwd, 'policy.json');
        writeJson(path, {
            id: 'valid',
            description: 'valid',
            targets: ['src/**/*.ts'],
            rationale: ['why'],
            notes: ['note'],
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts'],
            rules: [
                {
                    id: 'rule',
                    engine: 'rg',
                    message: 'msg',
                    allow: ['src/allowed.ts'],
                    match: {
                        kind: 'rg',
                        pattern: 'foo',
                        flags: 'iw',
                    },
                },
            ],
        });

        expect(loadPolicy(path)).toEqual({
            id: 'valid',
            description: 'valid',
            targets: ['src/**/*.ts'],
            rationale: ['why'],
            notes: ['note'],
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts'],
            rules: [
                {
                    id: 'rule',
                    engine: 'rg',
                    message: 'msg',
                    severity: 'error',
                    allow: ['src/allowed.ts'],
                    match: {
                        kind: 'rg',
                        pattern: 'foo',
                        flags: 'iw',
                    },
                },
            ],
        });
    });

    test('rejects non-object policies', () => {
        expect(() => validatePolicy(null, 'bad.json')).toThrow('must be an object');
    });

    test('rejects missing targets and rules', () => {
        expect(() => validatePolicy({ id: 'x', description: 'x', rules: [] }, 'bad.json')).toThrow('targets');
        expect(() => validatePolicy({ id: 'x', description: 'x', targets: ['src/**/*.ts'] }, 'bad.json')).toThrow(
            'rules',
        );
    });

    test('rejects malformed optional arrays', () => {
        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'msg',
                            match: { kind: 'rg', pattern: 'foo' },
                        },
                    ],
                    rationale: ['ok', ''],
                },
                'bad.json',
            ),
        ).toThrow('rationale');
    });

    test('rejects mismatched engine and match kind', () => {
        expect(() =>
            validatePolicy(
                {
                    id: 'bad',
                    description: 'bad',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'bad',
                            match: {
                                kind: 'sg',
                                pattern: 'foo',
                            },
                        },
                    ],
                },
                'bad.json',
            ),
        ).toThrow('must align engine');
    });

    test('rejects malformed rules and fixes', () => {
        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [null],
                },
                'bad.json',
            ),
        ).toThrow('must be an object');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [{ id: 'rule', engine: 'bad', message: 'msg', match: { kind: 'rg', pattern: 'foo' } }],
                },
                'bad.json',
            ),
        ).toThrow('engine');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [{ id: 'rule', engine: 'rg', message: 'msg' }],
                },
                'bad.json',
            ),
        ).toThrow('"match"');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [{ id: 'rule', engine: 'rg', message: 'msg', match: { kind: 'bad', pattern: 'foo' } }],
                },
                'bad.json',
            ),
        ).toThrow('match.kind');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'msg',
                            match: { kind: 'rg', pattern: 'foo' },
                            fix: 'bad',
                        },
                    ],
                },
                'bad.json',
            ),
        ).toThrow('fix must be an object');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'msg',
                            match: { kind: 'rg', pattern: 'foo' },
                            fix: { mode: 'bad' },
                        },
                    ],
                },
                'bad.json',
            ),
        ).toThrow('fix.mode');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'msg',
                            match: { kind: 'rg', pattern: 'foo' },
                            fix: { mode: 'command' },
                        },
                    ],
                },
                'bad.json',
            ),
        ).toThrow('command');

        expect(() =>
            validatePolicy(
                {
                    id: 'x',
                    description: 'x',
                    targets: ['src/**/*.ts'],
                    rules: [
                        {
                            id: 'rule',
                            engine: 'rg',
                            message: 'msg',
                            match: { kind: 'rg', pattern: 'foo' },
                            fix: { mode: 'rewrite' },
                        },
                    ],
                },
                'bad.json',
            ),
        ).toThrow('replace');
    });
});

describe('splitCommand', () => {
    test('tokenizes quoted command arguments without using a shell', () => {
        expect(splitCommand(`sed -i '' 's/foo/bar/g' {path}`)).toEqual(['sed', '-i', '', 's/foo/bar/g', '{path}']);
    });

    test('handles escaped spaces and rejects unterminated quotes', () => {
        expect(splitCommand(String.raw`echo hello\ world`)).toEqual(['echo', 'hello world']);
        expect(() => splitCommand(`echo 'unterminated`)).toThrow('Unterminated quote');
    });
});

describe('executePolicies', () => {
    test('fails closed when the policy directory does not exist', async () => {
        const cwd = makeTempDir();

        const result = await executePolicies('does-not-exist', [], {
            cwd,
            fix: false,
            preview: false,
            failFast: false,
        });

        expect(result.errors).toHaveLength(1);
        expect(result.policyIds).toEqual([]);
        expect(result.summary.exitCode).toBe(1);
    });

    test('reports missing selected policies and honors fail-fast on load errors', async () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        writeFileSync(join(cwd, 'policies', 'broken.json'), '{"id":');

        const result = await executePolicies('policies', ['missing', 'broken'], {
            cwd,
            fix: false,
            preview: false,
            failFast: true,
        });

        expect(result.errors[0]).toContain('Policy not found');
        expect(result.errors[1]).toContain('Failed to load');
        expect(result.summary.exitCode).toBe(1);
    });

    test('reports rg execution failures as execution errors', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'src'));
        const file = join(cwd, 'src', 'sample.ts');
        writeFileSync(file, `const value = 'x';\n`);

        const result = executeRg(
            {
                kind: 'rg',
                pattern: 'value',
            },
            file,
            join(cwd, 'missing'),
        );

        expect(result.matches).toEqual([]);
        expect(result.error).toBeTruthy();
        expect(extractExecError({ stderr: 'boom' })).toBe('boom');
    });

    test('executes a rewrite fix when not in preview mode', async () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        const file = join(cwd, 'src', 'sample.ts');
        writeFileSync(file, 'foo\nfoo\n');
        writeJson(join(cwd, 'policies', 'rewrite.json'), {
            id: 'rewrite',
            description: 'rewrite',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'replace-foo',
                    engine: 'rg',
                    message: 'replace foo',
                    match: { kind: 'rg', pattern: 'foo' },
                    fix: { mode: 'rewrite', replace: 'bar' },
                },
            ],
        });

        const result = await executePolicies('policies', [], {
            cwd,
            fix: true,
            preview: false,
            failFast: false,
        });

        expect(result.fixes).toHaveLength(1);
        expect(result.fixes[0]?.success).toBe(true);
        expect(readFileSync(file, 'utf-8')).toBe('bar\nbar\n');
    });

    test('returns preview fixes during dry-run mode', async () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'sample.ts'), 'foo\n');
        writeJson(join(cwd, 'policies', 'rewrite.json'), {
            id: 'rewrite',
            description: 'rewrite',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'replace-foo',
                    engine: 'rg',
                    message: 'replace foo',
                    match: {
                        kind: 'rg',
                        pattern: 'foo',
                    },
                    fix: {
                        mode: 'rewrite',
                        replace: 'bar',
                    },
                },
            ],
        });

        const result = await executePolicies('policies', [], {
            cwd,
            fix: true,
            preview: true,
            failFast: false,
        });

        expect(result.violations).toHaveLength(1);
        expect(result.fixes).toHaveLength(1);
        expect(result.fixes[0]?.success).toBe(true);
        expect(result.fixes[0]?.output).toContain('[PREVIEW]');
        expect(readFileSync(join(cwd, 'src', 'sample.ts'), 'utf-8')).toBe('foo\n');
    });

    test('supports glob allowlists instead of substring matching', async () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'allowed.ts'), 'forbidden\n');
        writeJson(join(cwd, 'policies', 'allow.json'), {
            id: 'allow',
            description: 'allow',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'glob-allow',
                    engine: 'rg',
                    message: 'should be allowed',
                    allow: ['src/*.ts'],
                    match: {
                        kind: 'rg',
                        pattern: 'forbidden',
                    },
                },
            ],
        });

        const result = await executePolicies('policies', [], {
            cwd,
            fix: false,
            preview: false,
            failFast: false,
        });

        expect(result.violations).toHaveLength(0);
        expect(result.summary.filesChecked).toBe(1);
    });

    test('fails clearly for sg rules until the engine is implemented', async () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'sample.ts'), 'const value = 1;\n');
        writeJson(join(cwd, 'policies', 'sg.json'), {
            id: 'sg-policy',
            description: 'sg',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'sg-rule',
                    engine: 'sg',
                    message: 'sg rule',
                    match: {
                        kind: 'sg',
                        pattern: 'const $A = $B',
                    },
                },
            ],
        });

        const result = await executePolicies('policies', [], {
            cwd,
            fix: false,
            preview: false,
            failFast: false,
        });

        expect(result.violations).toHaveLength(0);
        expect(result.errors).toEqual([`Policy "sg-policy" rule "sg-rule" uses unsupported engine "sg"`]);
        expect(result.summary.exitCode).toBe(1);
    });

    test('returns discovery errors when cwd is invalid', async () => {
        const result = await executePolicies('policies', [], {
            cwd: join(makeTempDir(), 'missing'),
            fix: false,
            preview: false,
            failFast: false,
        });

        expect(result.summary.exitCode).toBe(1);
    });
});

describe('helpers', () => {
    test('discovers files with include filters', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'src', 'nested'), { recursive: true });
        writeFileSync(join(cwd, 'src', 'a.ts'), 'a\n');
        writeFileSync(join(cwd, 'src', 'nested', 'b.ts'), 'b\n');

        const result = discoverFiles(
            {
                id: 'p',
                description: 'p',
                targets: ['src/**/*.ts'],
                include: ['src/nested/*.ts'],
                rules: [],
            },
            cwd,
        );

        expect(result.error).toBeUndefined();
        expect(result.files).toEqual([join(cwd, 'src', 'nested', 'b.ts')]);
    });

    test('handles no-match glob and glob execution errors', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'a.ts'), 'a\n');

        expect(globFiles('src/**/*.nomatch', undefined, cwd)).toEqual({ files: [] });
        expect(globFiles('src/**/*.ts', undefined, join(cwd, 'missing')).error).toBeTruthy();
    });

    test('executes rg with flags and reports unsupported match kinds', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'src'));
        const file = join(cwd, 'src', 'a.ts');
        writeFileSync(file, 'Foo\n');

        const result = executeRg({ kind: 'rg', pattern: 'foo', flags: 'iw' }, file, cwd);
        expect(result.matches).toHaveLength(1);
        expect(executeRg({ kind: 'sg', pattern: 'x' }, file, cwd).error).toContain('Unsupported match kind');
    });

    test('covers executeFix command and rewrite failure branches', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'src'));
        const file = join(cwd, 'src', 'a.ts');
        writeFileSync(file, 'hello\n');

        expect(
            executeFix(
                {
                    id: 'cmd',
                    engine: 'rg',
                    message: 'cmd',
                    match: { kind: 'rg', pattern: 'hello' },
                    fix: { mode: 'command', command: `echo fixed {path}` },
                },
                file,
                { cwd, preview: false },
            ).success,
        ).toBe(true);

        expect(
            executeFix(
                {
                    id: 'bad-cmd',
                    engine: 'rg',
                    message: 'bad',
                    match: { kind: 'rg', pattern: 'hello' },
                    fix: { mode: 'command', command: '' },
                },
                file,
                { cwd, preview: false },
            ).success,
        ).toBe(false);

        expect(
            executeRewriteFix(
                {
                    id: 'missing-replace',
                    engine: 'rg',
                    message: 'bad',
                    match: { kind: 'rg', pattern: 'hello' },
                    fix: { mode: 'rewrite' },
                },
                file,
                false,
            ).error,
        ).toContain('missing replacement');

        expect(
            executeRewriteFix(
                {
                    id: 'bad-kind',
                    engine: 'sg',
                    message: 'bad',
                    match: { kind: 'sg', pattern: 'x' },
                    fix: { mode: 'rewrite', replace: 'y' },
                },
                file,
                false,
            ).error,
        ).toContain('supports rg rules only');

        expect(
            executeRewriteFix(
                {
                    id: 'bad-regex',
                    engine: 'rg',
                    message: 'bad',
                    match: { kind: 'rg', pattern: '(' },
                    fix: { mode: 'rewrite', replace: 'y' },
                },
                file,
                false,
            ).error,
        ).toContain('Invalid rewrite regex');

        expect(
            executeRewriteFix(
                {
                    id: 'no-change',
                    engine: 'rg',
                    message: 'bad',
                    match: { kind: 'rg', pattern: 'missing' },
                    fix: { mode: 'rewrite', replace: 'y' },
                },
                file,
                false,
            ).error,
        ).toContain('made no changes');
    });

    test('covers path and formatting helpers', () => {
        expect(buildRegexFlags()).toBe('g');
        expect(buildRegexFlags('im')).toContain('i');
        expect(buildRegexFlags('im')).toContain('m');
        expect(matchesGlob('src/a.ts', 'src/*.ts')).toBe(true);
        expect(matchesAnyPattern('src/a.ts', ['dist/*', 'src/*.ts'])).toBe(true);
        expect(normalizePath('a\\b')).toBe('a/b');
        expect(toRelativePath('/tmp/root', '/tmp/root/a/b.ts')).toBe('a/b.ts');
        expect(toDisplayPath('a\\b')).toBe('a/b');
        expect(isNoMatchError({ status: 1 })).toBe(true);
        expect(extractExecError('plain')).toBe('plain');
        expect(extractExecError({ stderr: new Uint8Array([111, 107]) })).toBe('ok');
        expect(extractExecError({ message: 'fallback' })).toBe('fallback');

        expect(
            formatViolation(
                {
                    policy: 'p',
                    rule: 'r',
                    file: 'file.ts',
                    line: 3,
                    message: 'bad',
                    severity: 'warning',
                    fixAvailable: true,
                },
                false,
            ),
        ).toContain('[fixable]');

        expect(
            formatFixResult(
                {
                    rule: 'r',
                    file: 'file.ts',
                    success: false,
                    error: 'bad',
                },
                false,
            ),
        ).toContain('Error: bad');
    });

    test('covers summary computation and executePolicy branches', () => {
        const summary = computeSummary(
            [
                { policy: 'p', rule: 'r', file: 'a', line: 1, message: 'm', severity: 'error', fixAvailable: false },
                { policy: 'p', rule: 'r', file: 'b', line: 1, message: 'm', severity: 'warning', fixAvailable: false },
            ],
            [{ rule: 'r', file: 'a', success: false }],
            2,
            5,
            1,
        );
        expect(summary.exitCode).toBe(1);
        expect(summary.filesChecked).toBe(5);

        const cwd = makeTempDir();
        const result = executePolicy(
            {
                id: 'p',
                description: 'p',
                targets: ['src/**/*.ts'],
                rules: [
                    {
                        id: 'sg',
                        engine: 'sg',
                        message: 'sg',
                        match: { kind: 'sg', pattern: 'x' },
                    },
                ],
            },
            { cwd: join(cwd, 'missing'), fix: false, preview: false, failFast: false },
        );
        expect(result.errors[0]).toContain('file discovery failed');
    });
});

describe('external-api-boundaries policy', () => {
    test('allows approved wrappers and blocks direct fetch elsewhere', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'apps', 'web', 'src', 'lib'), { recursive: true });
        mkdirSync(join(cwd, 'apps', 'server', 'src'), { recursive: true });

        writeFileSync(
            join(cwd, 'apps', 'web', 'src', 'lib', 'browser-api-client.ts'),
            'export async function ok() { return fetch("https://example.com"); }\n',
        );
        writeFileSync(
            join(cwd, 'apps', 'server', 'src', 'bad.ts'),
            'export async function bad() { return fetch("https://example.com"); }\n',
        );

        const policy = loadPolicy(resolve(process.cwd(), 'policies', 'external-api-boundaries.json'));
        const result = executePolicy(policy, {
            cwd,
            fix: false,
            preview: false,
            failFast: false,
        });

        expect(result.errors).toEqual([]);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.rule).toBe('no-direct-fetch');
        expect(result.violations[0]?.file).toBe(join(cwd, 'apps', 'server', 'src', 'bad.ts'));
    });
});

describe('output and main', () => {
    test('prints usage', () => {
        const { stdout } = captureOutput(() => printUsage());
        expect(stdout).toContain('Policy Driver');
    });

    test('prints report and json output', () => {
        Object.defineProperty(process.stdout, 'isTTY', {
            configurable: true,
            value: true,
        });

        const report = captureOutput(() =>
            printReport(
                [
                    {
                        policy: 'p',
                        rule: 'r',
                        file: 'f.ts',
                        line: 1,
                        message: 'm',
                        severity: 'error',
                        fixAvailable: true,
                    },
                ],
                [{ rule: 'r', file: 'f.ts', success: true, output: 'ok' }],
                ['p', 'q'],
                computeSummary(
                    [
                        {
                            policy: 'p',
                            rule: 'r',
                            file: 'f.ts',
                            line: 1,
                            message: 'm',
                            severity: 'error',
                            fixAvailable: true,
                        },
                    ],
                    [{ rule: 'r', file: 'f.ts', success: true, output: 'ok' }],
                    2,
                    1,
                    1,
                ),
                ['engine bad'],
                true,
            ),
        );
        expect(report.stdout).toContain('Failed policies');
        expect(report.stderr).toContain('engine bad');

        const json = captureOutput(() => printJson([], [], ['p'], computeSummary([], [], 1, 0, 0), []));
        expect(() => JSON.parse(json.stdout)).not.toThrow();
    });

    test('parses args and exercises main help/report/machine paths', async () => {
        expect(
            parseArgs([
                '--fix',
                '--dry-run',
                '--machine',
                '--fail-fast',
                '--policy-dir',
                'pol',
                '--cwd',
                '/tmp',
                '-p',
                'a',
                'b',
            ]),
        ).toEqual({
            policy: ['a', 'b'],
            fix: true,
            preview: true,
            machine: true,
            policyDir: 'pol',
            failFast: true,
            cwd: '/tmp',
            help: false,
        });

        const help = captureOutput(() => main(['--help']));
        expect(await help.result).toBe(0);
        expect(help.stdout).toContain('Usage:');

        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'sample.ts'), 'forbidden\n');
        writeJson(join(cwd, 'policies', 'bad.json'), {
            id: 'bad',
            description: 'bad',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'rule',
                    engine: 'rg',
                    message: 'bad',
                    match: { kind: 'rg', pattern: 'forbidden' },
                },
            ],
        });

        const report = await captureOutputAsync(() => main(['--policy-dir', join(cwd, 'policies'), '--cwd', cwd]));
        expect(report.result).toBe(1);
        expect(report.stdout).toContain('Violations:');

        const machine = await captureOutputAsync(() =>
            main(['--policy-dir', join(cwd, 'policies'), '--cwd', cwd, '--machine']),
        );
        expect(machine.result).toBe(1);
        expect(() => JSON.parse(machine.stdout)).not.toThrow();
    });
});

describe('policy-check CLI', () => {
    test('emits pure JSON in machine mode', () => {
        const cwd = makeTempDir();
        mkdirSync(join(cwd, 'policies'));
        mkdirSync(join(cwd, 'src'));
        writeFileSync(join(cwd, 'src', 'sample.ts'), 'const value = 1;\n');
        writeJson(join(cwd, 'policies', 'clean.json'), {
            id: 'clean',
            description: 'clean',
            targets: ['src/**/*.ts'],
            rules: [
                {
                    id: 'no-match',
                    engine: 'rg',
                    message: 'no match',
                    match: {
                        kind: 'rg',
                        pattern: 'definitely-not-present',
                    },
                },
            ],
        });

        const output = execFileSync(
            'bun',
            [
                'run',
                resolve(process.cwd(), 'scripts/policy-check.ts'),
                '--policy-dir',
                join(cwd, 'policies'),
                '--machine',
                '--cwd',
                cwd,
            ],
            {
                cwd: process.cwd(),
                encoding: 'utf-8',
            },
        );

        expect(() => JSON.parse(output)).not.toThrow();
        const parsed = JSON.parse(output) as { summary: { exitCode: number; filesChecked: number } };
        expect(parsed.summary.exitCode).toBe(0);
        expect(parsed.summary.filesChecked).toBe(1);
    });
});
