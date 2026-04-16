import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScaffoldService } from '../../../src/commands/scaffold/services/scaffold-service';

// ── Test fixtures ────────────────────────────────────────────────────────

const TEST_ROOT = '/tmp/scaffold-service-test';

function setupTestDir() {
    cleanupTestDir();
    mkdirSync(TEST_ROOT, { recursive: true });
}

function cleanupTestDir() {
    if (existsSync(TEST_ROOT)) {
        rmSync(TEST_ROOT, { recursive: true, force: true });
    }
}

function makeService(root?: string) {
    return new ScaffoldService(root ?? TEST_ROOT);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ScaffoldService', () => {
    beforeEach(() => {
        setupTestDir();
    });

    afterEach(() => {
        cleanupTestDir();
    });

    // ── Constructor ────────────────────────────────────────────────────

    describe('constructor', () => {
        it('should use provided root path', () => {
            const service = new ScaffoldService('/custom/path');
            expect(service.getRoot()).toBe('/custom/path');
        });

        it('should default to cwd when no root provided', () => {
            const service = new ScaffoldService();
            expect(service.getRoot()).toBe(process.cwd());
        });
    });

    // ── getRoot / resolvePath ──────────────────────────────────────────

    describe('getRoot', () => {
        it('should return the configured root path', () => {
            const service = makeService();
            expect(service.getRoot()).toBe(TEST_ROOT);
        });
    });

    describe('resolvePath', () => {
        it('should resolve relative path to absolute', () => {
            const service = makeService();
            const absPath = service.resolvePath('package.json');
            expect(absPath).toBe(join(TEST_ROOT, 'package.json'));
        });

        it('should resolve nested paths', () => {
            const service = makeService();
            const absPath = service.resolvePath('packages/core/src/index.ts');
            expect(absPath).toBe(join(TEST_ROOT, 'packages/core/src/index.ts'));
        });
    });

    // ── exists ─────────────────────────────────────────────────────────

    describe('exists', () => {
        it('should return true for existing file', () => {
            writeFileSync(join(TEST_ROOT, 'test.txt'), 'hello');
            const service = makeService();
            expect(service.exists('test.txt')).toBe(true);
        });

        it('should return false for missing file', () => {
            const service = makeService();
            expect(service.exists('nonexistent.txt')).toBe(false);
        });

        it('should return true for existing directory', () => {
            mkdirSync(join(TEST_ROOT, 'subdir'), { recursive: true });
            const service = makeService();
            expect(service.exists('subdir')).toBe(true);
        });
    });

    // ── readFile / readJson ────────────────────────────────────────────

    describe('readFile', () => {
        it('should read file content as string', () => {
            writeFileSync(join(TEST_ROOT, 'hello.txt'), 'hello world');
            const service = makeService();
            expect(service.readFile('hello.txt')).toBe('hello world');
        });

        it('should read UTF-8 content', () => {
            writeFileSync(join(TEST_ROOT, 'utf8.txt'), '日本語テスト');
            const service = makeService();
            expect(service.readFile('utf8.txt')).toBe('日本語テスト');
        });
    });

    describe('readJson', () => {
        it('should parse JSON file', () => {
            const data = { name: 'test', version: '1.0.0' };
            writeFileSync(join(TEST_ROOT, 'data.json'), JSON.stringify(data));
            const service = makeService();
            const result = service.readJson<{ name: string; version: string }>('data.json');
            expect(result.name).toBe('test');
            expect(result.version).toBe('1.0.0');
        });

        it('should parse JSON with nested objects', () => {
            const data = { scripts: { build: 'tsc', test: 'bun test' } };
            writeFileSync(join(TEST_ROOT, 'pkg.json'), JSON.stringify(data));
            const service = makeService();
            const result = service.readJson<typeof data>('pkg.json');
            expect(result.scripts.build).toBe('tsc');
        });
    });

    // ── writeFile / writeJson ──────────────────────────────────────────

    describe('writeFile', () => {
        it('should write content to file', () => {
            const service = makeService();
            service.writeFile('output.txt', 'written content');
            const content = readFileSync(join(TEST_ROOT, 'output.txt'), 'utf-8');
            expect(content).toBe('written content');
        });

        it('should overwrite existing file', () => {
            writeFileSync(join(TEST_ROOT, 'overwrite.txt'), 'old');
            const service = makeService();
            service.writeFile('overwrite.txt', 'new');
            const content = readFileSync(join(TEST_ROOT, 'overwrite.txt'), 'utf-8');
            expect(content).toBe('new');
        });
    });

    describe('writeJson', () => {
        it('should write formatted JSON with trailing newline', () => {
            const service = makeService();
            service.writeJson('data.json', { key: 'value' });
            const content = readFileSync(join(TEST_ROOT, 'data.json'), 'utf-8');
            expect(content).toBe(`${JSON.stringify({ key: 'value' }, null, 2)}\n`);
        });

        it('should write nested JSON', () => {
            const service = makeService();
            service.writeJson('nested.json', { a: { b: [1, 2, 3] } });
            const parsed = JSON.parse(readFileSync(join(TEST_ROOT, 'nested.json'), 'utf-8'));
            expect(parsed.a.b).toEqual([1, 2, 3]);
        });
    });

    // ── deleteFile ─────────────────────────────────────────────────────

    describe('deleteFile', () => {
        it('should delete a file', () => {
            const filePath = join(TEST_ROOT, 'to-delete.txt');
            writeFileSync(filePath, 'delete me');
            expect(existsSync(filePath)).toBe(true);

            const service = makeService();
            service.deleteFile('to-delete.txt');
            expect(existsSync(filePath)).toBe(false);
        });

        it('should delete a directory recursively', () => {
            const dirPath = join(TEST_ROOT, 'to-delete-dir');
            mkdirSync(dirPath, { recursive: true });
            writeFileSync(join(dirPath, 'file.txt'), 'content');
            expect(existsSync(dirPath)).toBe(true);

            const service = makeService();
            service.deleteFile('to-delete-dir');
            expect(existsSync(dirPath)).toBe(false);
        });

        it('should not throw when deleting nonexistent path', () => {
            const service = makeService();
            expect(() => service.deleteFile('nonexistent')).not.toThrow();
        });
    });

    // ── copyFile ───────────────────────────────────────────────────────

    describe('copyFile', () => {
        it('should copy a file', () => {
            writeFileSync(join(TEST_ROOT, 'src.txt'), 'copy me');
            const service = makeService();
            service.copyFile('src.txt', 'dest.txt');

            const content = readFileSync(join(TEST_ROOT, 'dest.txt'), 'utf-8');
            expect(content).toBe('copy me');
            expect(existsSync(join(TEST_ROOT, 'src.txt'))).toBe(true);
        });

        it('should copy a directory recursively', () => {
            const srcDir = join(TEST_ROOT, 'src-dir');
            mkdirSync(srcDir, { recursive: true });
            writeFileSync(join(srcDir, 'a.txt'), 'a');
            writeFileSync(join(srcDir, 'b.txt'), 'b');

            const service = makeService();
            service.copyFile('src-dir', 'dest-dir');

            expect(existsSync(join(TEST_ROOT, 'dest-dir', 'a.txt'))).toBe(true);
            expect(existsSync(join(TEST_ROOT, 'dest-dir', 'b.txt'))).toBe(true);
            expect(readFileSync(join(TEST_ROOT, 'dest-dir', 'a.txt'), 'utf-8')).toBe('a');
        });
    });

    // ── Staging ────────────────────────────────────────────────────────

    describe('stageWrite', () => {
        it('should stage a write change', () => {
            const service = makeService();
            service.stageWrite('test.txt', 'content');
            const changes = service.getStagedChanges();
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({ path: 'test.txt', action: 'write', content: 'content' });
        });

        it('should accumulate multiple staged writes', () => {
            const service = makeService();
            service.stageWrite('a.txt', 'a');
            service.stageWrite('b.txt', 'b');
            expect(service.getStagedChanges()).toHaveLength(2);
        });
    });

    describe('stageDelete', () => {
        it('should stage a delete change', () => {
            const service = makeService();
            service.stageDelete('old.txt');
            const changes = service.getStagedChanges();
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({ path: 'old.txt', action: 'delete' });
        });
    });

    describe('getStagedChanges', () => {
        it('should return a copy of staged changes', () => {
            const service = makeService();
            service.stageWrite('a.txt', 'a');
            const changes = service.getStagedChanges();
            changes.push({ path: 'extra.txt', action: 'write', content: 'x' });
            // Original should be unaffected
            expect(service.getStagedChanges()).toHaveLength(1);
        });

        it('should return empty array when no changes staged', () => {
            const service = makeService();
            expect(service.getStagedChanges()).toEqual([]);
        });
    });

    describe('clearStagedChanges', () => {
        it('should clear all staged changes', () => {
            const service = makeService();
            service.stageWrite('a.txt', 'a');
            service.stageDelete('b.txt');
            expect(service.getStagedChanges()).toHaveLength(2);

            service.clearStagedChanges();
            expect(service.getStagedChanges()).toEqual([]);
        });
    });

    // ── hasChanges ─────────────────────────────────────────────────────

    describe('hasChanges', () => {
        it('should return true when file does not exist', () => {
            const service = makeService();
            expect(service.hasChanges('missing.txt', 'content')).toBe(true);
        });

        it('should return true when content differs', () => {
            writeFileSync(join(TEST_ROOT, 'existing.txt'), 'old content');
            const service = makeService();
            expect(service.hasChanges('existing.txt', 'new content')).toBe(true);
        });

        it('should return false when content is identical', () => {
            writeFileSync(join(TEST_ROOT, 'same.txt'), 'identical');
            const service = makeService();
            expect(service.hasChanges('same.txt', 'identical')).toBe(false);
        });
    });

    // ── listFiles ──────────────────────────────────────────────────────

    describe('listFiles', () => {
        it('should list files recursively with relative paths', () => {
            mkdirSync(join(TEST_ROOT, 'src', 'sub'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'src', 'a.ts'), '// a');
            writeFileSync(join(TEST_ROOT, 'src', 'sub', 'b.ts'), '// b');

            const service = makeService();
            const files = service.listFiles('src');
            expect(files).toContain('src/a.ts');
            expect(files).toContain('src/sub/b.ts');
        });

        it('should return empty array for nonexistent directory', () => {
            const service = makeService();
            expect(service.listFiles('nonexistent')).toEqual([]);
        });

        it('should filter by extensions when provided', () => {
            mkdirSync(join(TEST_ROOT, 'mixed'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'mixed', 'a.ts'), '// a');
            writeFileSync(join(TEST_ROOT, 'mixed', 'b.js'), '// b');
            writeFileSync(join(TEST_ROOT, 'mixed', 'c.md'), '# c');

            const service = makeService();
            const tsFiles = service.listFiles('mixed', ['.ts']);
            expect(tsFiles).toContain('mixed/a.ts');
            expect(tsFiles).not.toContain('mixed/b.js');
            expect(tsFiles).not.toContain('mixed/c.md');
        });

        it('should filter by multiple extensions', () => {
            mkdirSync(join(TEST_ROOT, 'multi'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'multi', 'a.ts'), '');
            writeFileSync(join(TEST_ROOT, 'multi', 'b.js'), '');
            writeFileSync(join(TEST_ROOT, 'multi', 'c.md'), '');

            const service = makeService();
            const files = service.listFiles('multi', ['.ts', '.js']);
            expect(files).toHaveLength(2);
        });

        it('should skip directories and only return files', () => {
            mkdirSync(join(TEST_ROOT, 'dirs', 'nested', 'deep'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'dirs', 'file.txt'), 'f');

            const service = makeService();
            const files = service.listFiles('dirs');
            expect(files).toEqual(['dirs/file.txt']);
        });
    });

    // ── collectTextFilePaths ───────────────────────────────────────────

    describe('collectTextFilePaths', () => {
        it('should collect files from apps, packages, scripts dirs', () => {
            mkdirSync(join(TEST_ROOT, 'apps', 'cli', 'src'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'packages', 'core', 'src'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'scripts'), { recursive: true });

            writeFileSync(join(TEST_ROOT, 'apps', 'cli', 'src', 'index.ts'), '');
            writeFileSync(join(TEST_ROOT, 'packages', 'core', 'src', 'index.ts'), '');
            writeFileSync(join(TEST_ROOT, 'scripts', 'build.ts'), '');

            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files).toContain('apps/cli/src/index.ts');
            expect(files).toContain('packages/core/src/index.ts');
            expect(files).toContain('scripts/build.ts');
        });

        it('should include root-level files when they exist', () => {
            writeFileSync(join(TEST_ROOT, 'README.md'), '# readme');
            writeFileSync(join(TEST_ROOT, 'AGENTS.md'), '# agents');

            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files).toContain('README.md');
            expect(files).toContain('AGENTS.md');
        });

        it('should include docs files excluding tasks dirs', () => {
            mkdirSync(join(TEST_ROOT, 'docs', 'tasks'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'docs', '.tasks'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'docs', 'arch.md'), '');
            writeFileSync(join(TEST_ROOT, 'docs', 'tasks', 'task.md'), '');

            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files).toContain('docs/arch.md');
            expect(files).not.toContain(expect.stringContaining('tasks'));
        });

        it('should skip ignored directories', () => {
            mkdirSync(join(TEST_ROOT, 'apps', 'web', 'src'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'apps', 'web', 'node_modules', 'pkg'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'apps', 'web', 'dist'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'apps', 'web', 'src', 'index.ts'), '');
            writeFileSync(join(TEST_ROOT, 'apps', 'web', 'node_modules', 'pkg', 'index.js'), '');

            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files).not.toContain(expect.stringContaining('node_modules'));
        });

        it('should only include text file extensions', () => {
            mkdirSync(join(TEST_ROOT, 'apps', 'app', 'src'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'apps', 'app', 'src', 'code.ts'), '');
            writeFileSync(join(TEST_ROOT, 'apps', 'app', 'src', 'binary.png'), 'fake');

            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files.some((f) => f.endsWith('.ts'))).toBe(true);
            expect(files.some((f) => f.endsWith('.png'))).toBe(false);
        });

        it('should skip missing root dirs gracefully', () => {
            // No apps, packages, scripts dirs at all
            writeFileSync(join(TEST_ROOT, 'README.md'), '# readme');
            const service = makeService();
            const files = service.collectTextFilePaths();
            expect(files).toContain('README.md');
        });

        it('should return sorted results', () => {
            mkdirSync(join(TEST_ROOT, 'packages', 'z'), { recursive: true });
            mkdirSync(join(TEST_ROOT, 'packages', 'a'), { recursive: true });
            writeFileSync(join(TEST_ROOT, 'packages', 'z', 'index.ts'), '');
            writeFileSync(join(TEST_ROOT, 'packages', 'a', 'index.ts'), '');

            const service = makeService();
            const files = service.collectTextFilePaths();
            for (let i = 1; i < files.length; i++) {
                expect(files[i] >= files[i - 1]).toBe(true);
            }
        });
    });

    // ── normalizeScope ─────────────────────────────────────────────────

    describe('normalizeScope', () => {
        it('should add @ prefix if missing', () => {
            const service = makeService();
            expect(service.normalizeScope('myorg')).toBe('@myorg');
        });

        it('should not add @ if already present', () => {
            const service = makeService();
            expect(service.normalizeScope('@myorg')).toBe('@myorg');
        });
    });

    // ── slugify ────────────────────────────────────────────────────────

    describe('slugify', () => {
        it('should convert to kebab-case', () => {
            const service = makeService();
            expect(service.slugify('MyProjectName')).toBe('myprojectname');
        });

        it('should handle spaces', () => {
            const service = makeService();
            expect(service.slugify('My Project Name')).toBe('my-project-name');
        });

        it('should trim leading/trailing dashes', () => {
            const service = makeService();
            expect(service.slugify('  my-project  ')).toBe('my-project');
        });

        it('should handle special characters', () => {
            const service = makeService();
            expect(service.slugify('My@Project#Name')).toBe('my-project-name');
        });

        it('should collapse multiple dashes', () => {
            const service = makeService();
            expect(service.slugify('a---b')).toBe('a-b');
        });
    });

    // ── toTitleCase ────────────────────────────────────────────────────

    describe('toTitleCase', () => {
        it('should convert kebab-case to Title Case', () => {
            const service = makeService();
            expect(service.toTitleCase('my-project-name')).toBe('My Project Name');
        });

        it('should handle single word', () => {
            const service = makeService();
            expect(service.toTitleCase('project')).toBe('Project');
        });

        it('should filter empty segments from consecutive dashes', () => {
            const service = makeService();
            expect(service.toTitleCase('a--b')).toBe('A B');
        });
    });

    // ── jsonEquals ─────────────────────────────────────────────────────

    describe('jsonEquals', () => {
        it('should return true for equal JSON', () => {
            const service = makeService();
            expect(service.jsonEquals('{"a":1}', '{"a":1}')).toBe(true);
        });

        it('should return true for equal JSON with different spacing', () => {
            const service = makeService();
            expect(service.jsonEquals('{"a":1}', '{ "a": 1 }')).toBe(true);
        });

        it('should return false for different JSON', () => {
            const service = makeService();
            expect(service.jsonEquals('{"a":1}', '{"a":2}')).toBe(false);
        });

        it('should return false for invalid JSON', () => {
            const service = makeService();
            expect(service.jsonEquals('invalid', 'invalid')).toBe(false);
        });

        it('should handle one valid and one invalid JSON', () => {
            const service = makeService();
            expect(service.jsonEquals('{"a":1}', 'invalid')).toBe(false);
        });
    });
});
