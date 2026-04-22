#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type DocRule = {
    path: string;
    required: string[];
    forbidden: string[];
};

const root = resolve(import.meta.dir, '..');
const markdownFiles = [
    'README.md',
    'docs/01_ARCHITECTURE_SPEC.md',
    'docs/02_DEVELOPER_SPEC.md',
    'docs/04_SCAFFOLD_GUIDE.md',
];

const docRules: DocRule[] = [
    {
        path: 'README.md',
        required: [
            'Starter Profiles',
            '@starter/contracts',
            'bun run scaffold:init -- --name my-project --scope @acme --title "My Project"',
            'bun run smoke:generated',
        ],
        forbidden: ['build the binary file first', 'skill create', 'skill list', 'Hono JSX', 'HTMX'],
    },
    {
        path: 'docs/01_ARCHITECTURE_SPEC.md',
        required: ['Astro 5', 'React islands', 'Tailwind CSS v4', 'packages/contracts', 'scaffold CLI'],
        forbidden: ['Hono JSX', 'HTMX', 'skill create', 'apps/server/src/views'],
    },
    {
        path: 'docs/02_DEVELOPER_SPEC.md',
        required: ['apps/web', 'Astro 5', 'bun run scaffold:init -- --name my-project --scope @acme', 'bun run check'],
        forbidden: ['hono/jsx', 'apps/server/src/views', 'skill create'],
    },
    {
        path: 'docs/04_SCAFFOLD_GUIDE.md',
        required: ['Compiled Binary Workflow', 'Starter Profiles', 'scaffold validate --fix'],
        forbidden: ['build the binary file first', 'skill create'],
    },
];

const globalForbidden = ['issues/XXXX'];

function read(path: string): string {
    return readFileSync(resolve(root, path), 'utf8');
}

function hasBalancedCodeFences(content: string): boolean {
    const fenceCount = content.match(/^```/gm)?.length ?? 0;
    return fenceCount % 2 === 0;
}

const failures: string[] = [];

for (const path of markdownFiles) {
    const content = read(path);
    if (!hasBalancedCodeFences(content)) {
        failures.push(`${path}: unbalanced fenced code blocks`);
    }
}

for (const rule of docRules) {
    const content = read(rule.path);
    for (const required of rule.required) {
        if (!content.includes(required)) {
            failures.push(`${rule.path}: missing required text "${required}"`);
        }
    }
    for (const forbidden of rule.forbidden) {
        if (content.includes(forbidden)) {
            failures.push(`${rule.path}: contains stale text "${forbidden}"`);
        }
    }
}

for (const path of [...markdownFiles, 'bunfig.toml']) {
    const content = read(path);
    for (const forbidden of globalForbidden) {
        if (content.includes(forbidden)) {
            failures.push(`${path}: contains placeholder "${forbidden}"`);
        }
    }
}

if (failures.length > 0) {
    process.stderr.write(`Documentation checks failed (${failures.length}):\n`);
    for (const failure of failures) {
        process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
}

process.stdout.write('Documentation checks passed.\n');
