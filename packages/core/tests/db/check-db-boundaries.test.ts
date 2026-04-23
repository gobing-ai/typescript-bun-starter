import { describe, expect, mock, test } from 'bun:test';
import {
    collectBoundaryViolations,
    collectSchemaLeakViolations,
    handleMainExit,
    isAllowedDbImport,
    main,
    runBoundaryCheck,
} from '../../../../scripts/check-db-boundaries';

describe('check-db-boundaries', () => {
    test('allows DB imports inside approved infrastructure files', () => {
        expect(isAllowedDbImport('packages/core/src/db/skills-dao.ts')).toBe(true);
        expect(isAllowedDbImport('packages/core/tests/test-db.ts')).toBe(false);
        expect(isAllowedDbImport('apps/cli/tests/test-setup.ts')).toBe(false);
    });

    test('flags DB imports outside the approved boundary', () => {
        const violations = collectBoundaryViolations([
            `apps/server/src/index.ts:5:import { drizzle } from 'drizzle-orm/d1';`,
            `packages/core/src/db/schema.ts:1:import { sqliteTable } from 'drizzle-orm/sqlite-core';`,
            `apps/web/src/lib/api-client.ts:2:import { Database } from 'bun:sqlite';`,
        ]);

        expect(violations).toEqual([
            {
                file: 'apps/server/src/index.ts',
                line: 5,
                detail: 'imports "drizzle-orm/d1" outside the allowed DB boundary',
            },
            {
                file: 'apps/web/src/lib/api-client.ts',
                line: 2,
                detail: 'imports "bun:sqlite" outside the allowed DB boundary',
            },
        ]);
    });

    test('flags schema re-exports outside the DB boundary', () => {
        const violations = collectSchemaLeakViolations([
            `packages/core/src/index.ts:10:export { skills } from './db/schema';`,
            `packages/core/src/db/internal.ts:2:export { skills } from './schema';`,
        ]);

        expect(violations).toEqual([
            {
                file: 'packages/core/src/index.ts',
                line: 10,
                detail: 're-exports "./db/schema" outside the allowed DB boundary',
            },
        ]);
    });

    test('passes when the scan returns only allowed imports', () => {
        const writes: string[] = [];
        const spawnSync = mock(() => ({
            exitCode: 0,
            stdout: new TextEncoder().encode(
                [
                    `packages/core/src/db/schema.ts:1:import { sqliteTable } from 'drizzle-orm/sqlite-core';`,
                    `packages/core/src/db/adapters/bun-sqlite.ts:1:import { Database } from 'bun:sqlite';`,
                ].join('\n'),
            ),
            stderr: new Uint8Array(),
        }));

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
            { write: (_chunk: string) => true },
        );

        expect(exitCode).toBe(0);
        expect(writes).toEqual(['DB boundary checks passed.\n']);
    });

    test('fails when the scan finds a disallowed import', () => {
        const writes: string[] = [];
        const spawnSync = mock(() => ({
            exitCode: 0,
            stdout: new TextEncoder().encode(`apps/server/src/index.ts:5:import { drizzle } from 'drizzle-orm/d1';`),
            stderr: new Uint8Array(),
        }));

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            { write: (_chunk: string) => true },
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
        );

        expect(exitCode).toBe(1);
        expect(writes.join('')).toContain('apps/server/src/index.ts:5 imports "drizzle-orm/d1"');
    });

    test('fails fast when ripgrep cannot run', () => {
        const writes: string[] = [];
        const spawnSync = mock(() => ({
            exitCode: 2,
            stdout: new Uint8Array(),
            stderr: new TextEncoder().encode('rg failed'),
        }));

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            { write: (_chunk: string) => true },
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
        );

        expect(exitCode).toBe(2);
        expect(writes).toEqual(['rg failed']);
    });

    test('fails when the scan finds a schema re-export leak', () => {
        const writes: string[] = [];
        let callCount = 0;
        const spawnSync = mock(() => {
            callCount += 1;
            if (callCount === 1) {
                return {
                    exitCode: 1,
                    stdout: new Uint8Array(),
                    stderr: new Uint8Array(),
                };
            }

            return {
                exitCode: 0,
                stdout: new TextEncoder().encode(`packages/core/src/index.ts:10:export { skills } from './db/schema';`),
                stderr: new Uint8Array(),
            };
        });

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            { write: (_chunk: string) => true },
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
        );

        expect(exitCode).toBe(1);
        expect(writes.join('')).toContain(`packages/core/src/index.ts:10 re-exports "./db/schema"`);
    });

    test('handles string outputs from ripgrep results', () => {
        const writes: string[] = [];
        let callCount = 0;
        const spawnSync = mock(() => {
            callCount += 1;
            if (callCount === 1) {
                return {
                    exitCode: 0,
                    stdout: `packages/core/src/db/adapters/bun-sqlite.ts:1:import { Database } from 'bun:sqlite';`,
                    stderr: '',
                };
            }

            return {
                exitCode: 1,
                stdout: '',
                stderr: '',
            };
        });

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
            { write: (_chunk: string) => true },
        );

        expect(exitCode).toBe(0);
        expect(writes).toEqual(['DB boundary checks passed.\n']);
    });

    test('fails when the schema scan cannot run', () => {
        const writes: string[] = [];
        let callCount = 0;
        const spawnSync = mock(() => {
            callCount += 1;
            if (callCount === 1) {
                return {
                    exitCode: 1,
                    stdout: new Uint8Array(),
                    stderr: new Uint8Array(),
                };
            }

            return {
                exitCode: 2,
                stdout: new Uint8Array(),
                stderr: 'schema scan failed',
            };
        });

        const exitCode = runBoundaryCheck(
            spawnSync as unknown as typeof Bun.spawnSync,
            { write: (_chunk: string) => true },
            {
                write: (chunk: string) => {
                    writes.push(chunk);
                    return true;
                },
            },
        );

        expect(exitCode).toBe(2);
        expect(writes).toEqual(['schema scan failed']);
    });
});

describe('handleMainExit', () => {
    test('does not exit when the boundary check succeeds', () => {
        const exit = mock((_code?: number) => undefined);

        handleMainExit(0, exit as typeof process.exit);

        expect(exit).not.toHaveBeenCalled();
    });

    test('exits when the boundary check fails', () => {
        const exit = mock((_code?: number) => undefined);

        handleMainExit(3, exit as typeof process.exit);

        expect(exit).toHaveBeenCalledWith(3);
    });
});

describe('main', () => {
    test('runs successfully against the current workspace boundary state', () => {
        const originalStdoutWrite = process.stdout.write;
        const originalStderrWrite = process.stderr.write;
        process.stdout.write = (() => true) as typeof process.stdout.write;
        process.stderr.write = (() => true) as typeof process.stderr.write;

        try {
            expect(() => main()).not.toThrow();
        } finally {
            process.stdout.write = originalStdoutWrite;
            process.stderr.write = originalStderrWrite;
        }
    });
});
