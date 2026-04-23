#!/usr/bin/env bun

export interface BoundaryViolation {
    file: string;
    line: number;
    detail: string;
}

type WriteTarget = Pick<typeof process.stdout, 'write'>;
type SpawnSyncFn = typeof Bun.spawnSync;

const importPattern = String.raw`^\s*import(?:\s+type)?[\s\S]*?from\s+['"](?<specifier>bun:sqlite|drizzle-orm(?:\/[^'"]+)*)['"]`;
const schemaLeakPattern = String.raw`^\s*export[\s\S]*from\s+['"](?:\.{1,2}\/)+db\/schema['"]`;
const appFilePattern = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const allowedFileMatchers = [/^packages\/core\/src\/db\/.+/, /^packages\/core\/tests\/db\/.+/];

export function isAllowedDbImport(file: string): boolean {
    return allowedFileMatchers.some((matcher) => matcher.test(file));
}

export function collectBoundaryViolations(lines: string[]): BoundaryViolation[] {
    const violations: BoundaryViolation[] = [];

    for (const line of lines) {
        if (!line) {
            continue;
        }

        const firstColon = line.indexOf(':');
        const secondColon = line.indexOf(':', firstColon + 1);
        if (firstColon === -1 || secondColon === -1) {
            continue;
        }

        const file = line.slice(0, firstColon);
        const lineNumber = Number(line.slice(firstColon + 1, secondColon));
        const source = line.slice(secondColon + 1);
        const match = source.match(/['"](?<specifier>bun:sqlite|drizzle-orm(?:\/[^'"]+)*)['"]/);
        const specifier = match?.groups?.specifier;

        if (!specifier || isAllowedDbImport(file)) {
            continue;
        }

        violations.push({
            file,
            line: Number.isNaN(lineNumber) ? 0 : lineNumber,
            detail: `imports "${specifier}" outside the allowed DB boundary`,
        });
    }

    return violations;
}

export function collectSchemaLeakViolations(lines: string[]): BoundaryViolation[] {
    const violations: BoundaryViolation[] = [];

    for (const line of lines) {
        if (!line) {
            continue;
        }

        const firstColon = line.indexOf(':');
        const secondColon = line.indexOf(':', firstColon + 1);
        if (firstColon === -1 || secondColon === -1) {
            continue;
        }

        const file = line.slice(0, firstColon);
        const lineNumber = Number(line.slice(firstColon + 1, secondColon));

        if (isAllowedDbImport(file)) {
            continue;
        }

        violations.push({
            file,
            line: Number.isNaN(lineNumber) ? 0 : lineNumber,
            detail: 're-exports "./db/schema" outside the allowed DB boundary',
        });
    }

    return violations;
}

function decodeOutput(output: string | Uint8Array | undefined): string {
    if (typeof output === 'string') {
        return output;
    }

    return output ? Buffer.from(output).toString() : '';
}

export function runBoundaryCheck(
    spawnSync: SpawnSyncFn = Bun.spawnSync,
    stdout: WriteTarget = process.stdout,
    stderr: WriteTarget = process.stderr,
): number {
    const result = spawnSync(
        [
            'rg',
            '--no-heading',
            '--line-number',
            '--with-filename',
            '--glob',
            '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
            importPattern,
            'apps',
            'packages',
            'scripts',
        ],
        {
            cwd: process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );

    if (result.exitCode !== 0 && result.exitCode !== 1) {
        stderr.write(decodeOutput(result.stderr) || 'DB boundary check failed to scan imports.\n');
        return result.exitCode;
    }

    const output = decodeOutput(result.stdout);
    const lines = output.split('\n').filter((line) => line && appFilePattern.test(line.slice(0, line.indexOf(':'))));
    const violations = collectBoundaryViolations(lines);

    const schemaLeakResult = spawnSync(
        [
            'rg',
            '--no-heading',
            '--line-number',
            '--with-filename',
            '--glob',
            '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
            schemaLeakPattern,
            'apps',
            'packages',
            'scripts',
        ],
        {
            cwd: process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );

    if (schemaLeakResult.exitCode !== 0 && schemaLeakResult.exitCode !== 1) {
        stderr.write(decodeOutput(schemaLeakResult.stderr) || 'DB boundary check failed to scan schema re-exports.\n');
        return schemaLeakResult.exitCode;
    }

    const schemaLeakOutput = decodeOutput(schemaLeakResult.stdout);
    const schemaLeakLines = schemaLeakOutput
        .split('\n')
        .filter((line) => line && appFilePattern.test(line.slice(0, line.indexOf(':'))));
    violations.push(...collectSchemaLeakViolations(schemaLeakLines));

    if (violations.length > 0) {
        stderr.write(`DB boundary checks failed (${violations.length}):\n`);
        for (const violation of violations) {
            stderr.write(`- ${violation.file}:${violation.line} ${violation.detail}\n`);
        }
        return 1;
    }

    stdout.write('DB boundary checks passed.\n');
    return 0;
}

export function main(): void {
    const exitCode = runBoundaryCheck();
    handleMainExit(exitCode);
}

export function handleMainExit(exitCode: number, exit: typeof process.exit = process.exit): void {
    if (exitCode !== 0) {
        exit(exitCode);
    }
}

if (import.meta.main) {
    main();
}
