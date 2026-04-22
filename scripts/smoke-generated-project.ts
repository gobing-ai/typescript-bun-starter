#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '..');
const scratchRoot = mkdtempSync(join(tmpdir(), 'tbs-generated-smoke-'));
const projectRoot = join(scratchRoot, 'project');
const projectTempDir = join(projectRoot, '.tmp');

function writeLine(message: string): void {
    process.stderr.write(`${message}\n`);
}

function cleanup(): void {
    rmSync(scratchRoot, { recursive: true, force: true });
}

function copyFixture(): void {
    cpSync(repoRoot, projectRoot, {
        recursive: true,
        filter: (source) => {
            const relPath = source.startsWith(repoRoot) ? source.slice(repoRoot.length).replace(/^[/\\]/, '') : source;
            if (relPath === '') {
                return true;
            }

            const blocked = ['.git', 'coverage', 'dist', '.astro'];
            return !blocked.some(
                (entry) => relPath === entry || relPath.startsWith(`${entry}/`) || relPath.startsWith(`${entry}\\`),
            );
        },
    });

    mkdirSync(projectTempDir, { recursive: true });
}

function run(args: string[], label: string): void {
    writeLine(`> ${label}`);
    const result = spawnSync('bun', args, {
        cwd: projectRoot,
        env: {
            ...process.env,
            TMPDIR: projectTempDir,
            TEMP: projectTempDir,
            TMP: projectTempDir,
        },
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        if (result.stdout) {
            process.stderr.write(result.stdout);
        }
        if (result.stderr) {
            process.stderr.write(result.stderr);
        }
        throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
    }
}

try {
    copyFixture();

    run(
        [
            'run',
            'scaffold:init',
            '--',
            '--name',
            'smoke-app',
            '--scope',
            '@smoke',
            '--title',
            'Smoke App',
            '--skip-check',
        ],
        'initialize generated project',
    );
    run(['run', 'scaffold:validate', '--', '--json'], 'validate default CLI + API + Web profile');

    run(['run', 'scaffold:remove', '--', 'webapp'], 'remove web profile');
    run(['run', 'scaffold:validate', '--', '--json'], 'validate CLI + API profile');

    run(['run', 'scaffold:remove', '--', 'server'], 'remove server profile');
    run(['run', 'scaffold:validate', '--', '--json'], 'validate minimal CLI-only profile');

    run(['run', 'scaffold:add', '--', 'server'], 're-add server profile');
    run(['run', 'scaffold:add', '--', 'webapp'], 're-add web profile');
    run(['run', 'scaffold:validate', '--', '--json'], 'validate restored CLI + API + Web profile');
} finally {
    cleanup();
}

process.stdout.write('Generated-project smoke test passed.\n');
