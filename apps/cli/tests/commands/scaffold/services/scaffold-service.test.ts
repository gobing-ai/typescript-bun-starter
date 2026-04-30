import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScaffoldService } from '../../../../src/commands/scaffold/services/scaffold-service';

describe('ScaffoldService', () => {
    const tmpDir = join(import.meta.dir, `.tmp-scaffold-${Date.now()}`);

    beforeEach(() => {
        mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('constructor uses provided root', () => {
        const svc = new ScaffoldService(tmpDir);
        expect(svc.getRoot()).toBe(tmpDir);
    });

    test('resolvePath resolves relative to root', () => {
        const svc = new ScaffoldService(tmpDir);
        expect(svc.resolvePath('foo.txt')).toBe(join(tmpDir, 'foo.txt'));
    });

    test('exists returns false for missing file', () => {
        const svc = new ScaffoldService(tmpDir);
        expect(svc.exists('nope.txt')).toBe(false);
    });

    test('exists returns true for existing file', () => {
        writeFileSync(join(tmpDir, 'a.txt'), 'hello');
        const svc = new ScaffoldService(tmpDir);
        expect(svc.exists('a.txt')).toBe(true);
    });

    test('readFile reads file content', () => {
        writeFileSync(join(tmpDir, 'b.txt'), 'world');
        const svc = new ScaffoldService(tmpDir);
        expect(svc.readFile('b.txt')).toBe('world');
    });

    test('readJson parses JSON', () => {
        writeFileSync(join(tmpDir, 'c.json'), '{"x":1}');
        const svc = new ScaffoldService(tmpDir);
        expect(svc.readJson<{ x: number }>('c.json')).toEqual({ x: 1 });
    });

    test('writeFile creates file', () => {
        const svc = new ScaffoldService(tmpDir);
        svc.writeFile('d.txt', 'content');
        expect(readFileSync(join(tmpDir, 'd.txt'), 'utf8')).toBe('content');
    });

    test('writeJson writes formatted JSON', () => {
        const svc = new ScaffoldService(tmpDir);
        svc.writeJson('e.json', { a: 2 });
        expect(readFileSync(join(tmpDir, 'e.json'), 'utf8')).toBe('{\n  "a": 2\n}\n');
    });

    test('deleteFile removes file', () => {
        writeFileSync(join(tmpDir, 'f.txt'), 'bye');
        const svc = new ScaffoldService(tmpDir);
        svc.deleteFile('f.txt');
        expect(svc.exists('f.txt')).toBe(false);
    });

    test('runShell returns exit code', () => {
        const svc = new ScaffoldService(tmpDir);
        expect(svc.runShell('echo', ['hi'])).toBe(0);
    });

    test('runShell returns non-zero for failing command', () => {
        const svc = new ScaffoldService(tmpDir);
        expect(svc.runShell('false')).not.toBe(0);
    });
});
