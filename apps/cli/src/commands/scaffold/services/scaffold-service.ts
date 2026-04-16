import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cwd } from 'node:process';

/**
 * File operation result with path and optional error.
 */
export interface FileOperation {
    path: string;
    action: 'write' | 'delete' | 'copy';
    error?: string;
}

/**
 * Staged file change for dry-run or apply.
 */
export interface StagedChange {
    path: string;
    action: 'write' | 'delete';
    content?: string;
}

/**
 * Service for scaffold file operations.
 * Handles reading, writing, deleting files with dry-run support.
 */
export class ScaffoldService {
    private readonly root: string;
    private readonly pendingChanges: StagedChange[] = [];

    constructor(root?: string) {
        // Use process.cwd() as default (set to project root when running via bun run)
        this.root = root ?? cwd();
    }

    /**
     * Get the project root path.
     */
    getRoot(): string {
        return this.root;
    }

    /**
     * Resolve a relative path to absolute path.
     */
    resolvePath(relPath: string): string {
        return resolve(this.root, relPath);
    }

    /**
     * Check if a path exists.
     */
    exists(relPath: string): boolean {
        return existsSync(this.resolvePath(relPath));
    }

    /**
     * Read a text file.
     */
    readFile(relPath: string): string {
        return readFileSync(this.resolvePath(relPath), 'utf8');
    }

    /**
     * Read and parse a JSON file.
     */
    readJson<T>(relPath: string): T {
        return JSON.parse(this.readFile(relPath)) as T;
    }

    /**
     * Write a text file.
     */
    writeFile(relPath: string, content: string): void {
        const absPath = this.resolvePath(relPath);
        writeFileSync(absPath, content, 'utf8');
    }

    /**
     * Write a JSON file with pretty formatting.
     */
    writeJson(relPath: string, data: unknown): void {
        this.writeFile(relPath, `${JSON.stringify(data, null, 2)}\n`);
    }

    /**
     * Delete a file or directory recursively.
     */
    deleteFile(relPath: string): void {
        const absPath = this.resolvePath(relPath);
        rmSync(absPath, { recursive: true, force: true });
    }

    /**
     * Run a shell command in the project root.
     * Returns the exit code (0 = success).
     */
    runShell(command: string): number {
        try {
            execSync(command, { cwd: this.root, stdio: 'pipe' });
            return 0;
        } catch (err: unknown) {
            const error = err as { status?: number };
            return error.status ?? 1;
        }
    }

    /**
     * Copy a file or directory.
     */
    copyFile(srcRelPath: string, destRelPath: string): void {
        const src = this.resolvePath(srcRelPath);
        const dest = this.resolvePath(destRelPath);
        cpSync(src, dest, { recursive: true });
    }

    /**
     * Stage a file write for later application.
     * Used for dry-run mode.
     */
    stageWrite(relPath: string, content: string): void {
        this.pendingChanges.push({ path: relPath, action: 'write', content });
    }

    /**
     * Stage a file deletion for later application.
     * Used for dry-run mode.
     */
    stageDelete(relPath: string): void {
        this.pendingChanges.push({ path: relPath, action: 'delete' });
    }

    /**
     * Get all staged changes.
     */
    getStagedChanges(): StagedChange[] {
        return [...this.pendingChanges];
    }

    /**
     * Clear staged changes.
     */
    clearStagedChanges(): void {
        this.pendingChanges.length = 0;
    }

    /**
     * Check if content differs from existing file.
     */
    hasChanges(relPath: string, content: string): boolean {
        if (!this.exists(relPath)) {
            return true;
        }
        const existing = this.readFile(relPath);
        return existing !== content;
    }

    /**
     * Get list of files in a directory recursively.
     */
    listFiles(dirRelPath: string, extensions?: string[]): string[] {
        const results: string[] = [];
        const absDir = this.resolvePath(dirRelPath);

        if (!existsSync(absDir)) {
            return results;
        }

        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir).sort()) {
                const absPath = join(dir, entry);
                const relPath = relative(this.root, absPath);
                const stat = statSync(absPath);

                if (stat.isDirectory()) {
                    walk(absPath);
                } else if (stat.isFile()) {
                    if (!extensions || extensions.some((ext) => absPath.endsWith(ext))) {
                        results.push(relPath);
                    }
                }
            }
        };

        walk(absDir);
        return results;
    }

    /**
     * Collect all text file paths in the project.
     */
    collectTextFilePaths(): string[] {
        const results = new Set<string>();
        const roots = ['apps', 'packages', 'scripts'];

        for (const rootDir of roots) {
            const absRoot = this.resolvePath(rootDir);
            if (!existsSync(absRoot)) {
                continue;
            }
            for (const file of this.collectFiles(absRoot)) {
                results.add(relative(this.root, file));
            }
        }

        // Add root-level files
        const rootFiles = ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
        for (const file of rootFiles) {
            if (this.exists(file)) {
                results.add(file);
            }
        }

        // Add docs
        const docsDir = this.resolvePath('docs');
        if (existsSync(docsDir)) {
            for (const file of this.collectFiles(docsDir)) {
                const relPath = relative(this.root, file);
                if (!relPath.includes('/tasks') && !relPath.includes('/.tasks')) {
                    results.add(relPath);
                }
            }
        }

        return [...results].sort();
    }

    /**
     * Collect files recursively, respecting ignore patterns.
     */
    private collectFiles(dir: string): string[] {
        const results: string[] = [];
        const ignored = new Set([
            'node_modules',
            '.git',
            'coverage',
            'cov',
            'dist',
            '.astro',
            '.wrangler',
            '.tasks',
            'tasks',
        ]);

        const walk = (currentDir: string): void => {
            for (const entry of readdirSync(currentDir).sort()) {
                if (ignored.has(entry)) {
                    continue;
                }

                const absPath = join(currentDir, entry);
                const stat = statSync(absPath);

                if (stat.isDirectory()) {
                    // Skip certain directories
                    if (absPath.includes('/docs/tasks') || absPath.includes('/docs/.tasks')) {
                        continue;
                    }
                    walk(absPath);
                } else if (stat.isFile() && this.isTextFile(absPath)) {
                    results.push(absPath);
                }
            }
        };

        walk(dir);
        return results;
    }

    /**
     * Check if a file is a text file by extension.
     */
    private isTextFile(path: string): boolean {
        return /\.(?:md|json|ts|tsx|js|jsx|mjs|astro|yaml|yml|toml)$/.test(path);
    }

    /**
     * Compare two JSON strings for equality.
     */
    jsonEquals(left: string, right: string): boolean {
        try {
            return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
        } catch {
            return false;
        }
    }

    /**
     * Normalize NPM scope (add @ prefix if missing).
     */
    normalizeScope(scope: string): string {
        if (!scope.startsWith('@')) {
            return `@${scope}`;
        }
        return scope;
    }

    /**
     * Convert a string to kebab-case slug.
     */
    slugify(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Convert a string to Title Case.
     */
    toTitleCase(value: string): string {
        return value
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
