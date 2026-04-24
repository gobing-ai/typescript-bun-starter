#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { echo, echoError } from '@starter/core';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'coverage', 'dist', '.astro', '.tmp']);

const EXCLUDED_FILES = new Set(['bun.lock', 'package-lock.json', 'bunfig.toml']);

const EXCLUDED_PREFIXES = ['docs/tasks/', 'docs/.tasks/'];

interface FileEntry {
    relativePath: string;
    sourceAbs: string;
    targetAbs: string;
    status: 'new' | 'identical' | 'modified';
}

interface PlanEntry extends FileEntry {
    action: 'copy' | 'overwrite' | 'skip';
}

interface AnalyzeResult {
    newFiles: FileEntry[];
    identicalFiles: FileEntry[];
    modifiedFiles: FileEntry[];
    plan: PlanEntry[];
}

export interface Args {
    source: string;
    target: string;
    analyze: boolean;
    apply: boolean;
    plan: string;
    interactive: boolean;
    help: boolean;
}

export function parseArgs(argv: string[]): Args {
    const args: Args = {
        source: '',
        target: '',
        analyze: false,
        apply: false,
        plan: '',
        interactive: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else if (arg === '--source' && argv[i + 1]) {
            args.source = resolve(argv[++i] ?? '.');
        } else if (arg === '--target' && argv[i + 1]) {
            args.target = resolve(argv[++i] ?? '.');
        } else if (arg === '--analyze') {
            args.analyze = true;
        } else if (arg === '--apply') {
            args.apply = true;
        } else if (arg === '--plan' && argv[i + 1]) {
            args.plan = resolve(argv[++i] ?? 'migration-plan.json');
        } else if (arg === '--interactive' || arg === '-i') {
            args.interactive = true;
        }
    }

    return args;
}

export function collectFiles(root: string): string[] {
    const results: string[] = [];

    function walk(dir: string): void {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (EXCLUDED_DIRS.has(entry.name)) {
                continue;
            }

            const fullPath = join(dir, entry.name);
            const rel = relative(root, fullPath);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else {
                if (EXCLUDED_FILES.has(entry.name)) {
                    continue;
                }
                if (EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
                    continue;
                }
                results.push(rel);
            }
        }
    }

    walk(root);
    return results.sort();
}

function fileContentHash(path: string): string {
    const content = readFileSync(path);
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(content);
    return hasher.digest('hex');
}

export function analyze(source: string, target: string): AnalyzeResult {
    const sourceFiles = collectFiles(source);
    const newFiles: FileEntry[] = [];
    const identicalFiles: FileEntry[] = [];
    const modifiedFiles: FileEntry[] = [];
    const plan: PlanEntry[] = [];

    for (const relPath of sourceFiles) {
        const sourceAbs = join(source, relPath);
        const targetAbs = join(target, relPath);

        if (!existsSync(targetAbs)) {
            const entry: FileEntry = {
                relativePath: relPath,
                sourceAbs,
                targetAbs,
                status: 'new',
            };
            newFiles.push(entry);
            plan.push({ ...entry, action: 'copy' });
        } else {
            const sourceHash = fileContentHash(sourceAbs);
            const targetHash = fileContentHash(targetAbs);

            if (sourceHash === targetHash) {
                const entry: FileEntry = {
                    relativePath: relPath,
                    sourceAbs,
                    targetAbs,
                    status: 'identical',
                };
                identicalFiles.push(entry);
                plan.push({ ...entry, action: 'skip' });
            } else {
                const entry: FileEntry = {
                    relativePath: relPath,
                    sourceAbs,
                    targetAbs,
                    status: 'modified',
                };
                modifiedFiles.push(entry);
                plan.push({ ...entry, action: 'skip' });
            }
        }
    }

    return { newFiles, identicalFiles, modifiedFiles, plan };
}

export function generateDiff(sourceAbs: string, targetAbs: string): string {
    try {
        return execFileSync(
            'diff',
            [
                '-u',
                '--label',
                `current/${relative(resolve(sourceAbs, '../..'), targetAbs)}`,
                '--label',
                `starter/${relative(resolve(sourceAbs, '../..'), sourceAbs)}`,
                targetAbs,
                sourceAbs,
            ],
            {
                encoding: 'utf-8',
                timeout: 10000,
            },
        );
    } catch (error: unknown) {
        const execError = error as { stdout?: string };
        if (execError.stdout) {
            return execError.stdout;
        }
        return '(diff failed)';
    }
}

export function printAnalysis(result: AnalyzeResult, source: string): void {
    echo(`Source: ${source}`);
    echo(`Files scanned: ${result.newFiles.length + result.identicalFiles.length + result.modifiedFiles.length}`);
    echo('');

    if (result.newFiles.length > 0) {
        echo(`New files (${result.newFiles.length}):`);
        for (const f of result.newFiles) {
            echo(`  + ${f.relativePath}`);
        }
        echo('');
    }

    if (result.identicalFiles.length > 0) {
        echo(`Identical files (${result.identicalFiles.length}):`);
        for (const f of result.identicalFiles) {
            echo(`  = ${f.relativePath}`);
        }
        echo('');
    }

    if (result.modifiedFiles.length > 0) {
        echo(`Modified files (${result.modifiedFiles.length}):`);
        for (const f of result.modifiedFiles) {
            echo(`  ~ ${f.relativePath}`);
        }
        echo('');

        echo('Diffs:');
        echo('─'.repeat(60));
        for (const f of result.modifiedFiles) {
            echo('');
            echo(`--- ${f.relativePath}`);
            const diff = generateDiff(f.sourceAbs, f.targetAbs);
            echo(diff);
        }
    }
}

export function savePlan(plan: PlanEntry[], planPath: string): void {
    const serializable = plan.map((entry) => ({
        relativePath: entry.relativePath,
        status: entry.status,
        action: entry.action,
    }));
    writeFileSync(planPath, JSON.stringify(serializable, null, 2));
    echo(`Plan saved to ${planPath}`);
}

export function loadPlan(planPath: string): PlanEntry[] {
    const raw = JSON.parse(readFileSync(planPath, 'utf-8')) as Array<{
        relativePath: string;
        status: string;
        action: string;
    }>;

    return raw.map((entry) => ({
        relativePath: entry.relativePath,
        sourceAbs: '',
        targetAbs: '',
        status: entry.status as 'new' | 'identical' | 'modified',
        action: entry.action as 'copy' | 'overwrite' | 'skip',
    }));
}

export function applyPlan(
    plan: PlanEntry[],
    source: string,
    target: string,
): { applied: number; skipped: number; errors: string[] } {
    const actionable = plan.filter((entry) => entry.action === 'copy' || entry.action === 'overwrite');
    let applied = 0;
    const errors: string[] = [];

    for (const entry of actionable) {
        const sourceAbs = join(source, entry.relativePath);
        const targetAbs = join(target, entry.relativePath);

        if (!existsSync(sourceAbs)) {
            errors.push(`Source file missing: ${entry.relativePath}`);
            continue;
        }

        const targetDir = dirname(targetAbs);
        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }

        try {
            copyFileSync(sourceAbs, targetAbs);
            applied++;
        } catch (err) {
            errors.push(`Failed to copy ${entry.relativePath}: ${(err as Error).message}`);
        }
    }

    return {
        applied,
        skipped: plan.filter((entry) => entry.action === 'skip').length,
        errors,
    };
}

async function askQuestion(query: string): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function interactiveResolve(result: AnalyzeResult): Promise<PlanEntry[]> {
    const { plan, modifiedFiles } = result;

    if (modifiedFiles.length === 0) {
        echo('No conflicting files. All new files will be copied.');
        return plan;
    }

    echo('');
    echo(`${modifiedFiles.length} file(s) have conflicts.`);
    echo('For each file, choose: [o]verwrite, [k]eep, [s]kip');
    echo('Group commands: [ao] overwrite all, [ak] keep all, [as] skip all');
    echo('');

    for (const file of modifiedFiles) {
        const idx = plan.findIndex((p) => p.relativePath === file.relativePath);
        if (idx === -1) {
            continue;
        }

        echo(`\n~ ${file.relativePath}`);
        const diff = generateDiff(file.sourceAbs, file.targetAbs);
        const lines = diff.split('\n');
        const preview = lines.slice(0, 30).join('\n');
        echo(preview);
        if (lines.length > 30) {
            echo(`  ... (${lines.length - 30} more lines)`);
        }

        const answer = await askQuestion('\nAction [o/k/s]: ');

        if (answer === 'ao') {
            for (const m of modifiedFiles) {
                const i = plan.findIndex((p) => p.relativePath === m.relativePath);
                if (i !== -1 && plan[i]) {
                    plan[i].action = 'overwrite';
                }
            }
            break;
        }
        if (answer === 'ak' || answer === 'as') {
            for (const m of modifiedFiles) {
                const i = plan.findIndex((p) => p.relativePath === m.relativePath);
                if (i !== -1 && plan[i]) {
                    plan[i].action = 'skip';
                }
            }
            break;
        }
        if (answer === 'o' && plan[idx]) {
            plan[idx].action = 'overwrite';
        }
        // default: skip (already set)
    }

    return plan;
}

export function printUsage(): void {
    echo(
        `
Migration tool for applying @gobing-ai/typescript-bun-starter to existing projects.

Usage:
  bun scripts/apply-migration.ts [options]

Options:
  --source <path>      Path to the starter package (node_modules/@gobing-ai/typescript-bun-starter)
  --target <path>      Path to the target project
  --analyze            Analyze differences and generate a plan
  --apply              Apply a previously saved plan
  --plan <path>        Path to migration plan JSON file (default: migration-plan.json)
  --interactive, -i    Interactive mode: ask for each conflicting file
  -h, --help           Show this help message

Workflow:
  1. Install starter:   cd <project> && npm install @gobing-ai/typescript-bun-starter --save-dev
  2. Analyze:           bun scripts/apply-migration.ts --source <node_modules-path> --target <project> --analyze
  3. Interactive merge: bun scripts/apply-migration.ts --source <path> --target <path> --analyze -i
  4. Apply plan:        bun scripts/apply-migration.ts --source <path> --target <path> --apply --plan <plan-file>
`.trim(),
    );
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
    const args = parseArgs(argv);

    if (args.help) {
        printUsage();
        return 0;
    }

    if (!args.source || !args.target) {
        echoError('Error: --source and --target are required.');
        echoError('Use --help for usage information.');
        return 1;
    }

    if (!existsSync(args.source)) {
        echoError(`Source path does not exist: ${args.source}`);
        return 1;
    }

    if (!existsSync(args.target)) {
        echoError(`Target path does not exist: ${args.target}`);
        return 1;
    }

    const planPath = args.plan || resolve(args.target, 'migration-plan.json');

    if (args.analyze) {
        echo('Analyzing differences...');
        echo('');

        const result = analyze(args.source, args.target);

        if (args.interactive) {
            const resolvedPlan = await interactiveResolve(result);
            result.plan = resolvedPlan;
            savePlan(result.plan, planPath);
        } else {
            printAnalysis(result, args.source);
            savePlan(result.plan, planPath);
        }

        echo('');
        echo(
            `Summary: ${result.newFiles.length} new, ${result.identicalFiles.length} identical, ${result.modifiedFiles.length} modified`,
        );

        return 0;
    }

    if (args.apply) {
        if (!existsSync(planPath)) {
            echoError(`Plan file not found: ${planPath}`);
            echoError('Run with --analyze first to generate a plan.');
            return 1;
        }

        echo('Loading plan...');
        const plan = loadPlan(planPath);
        const actionable = plan.filter((e) => e.action !== 'skip');
        echo(`Applying ${actionable.length} changes...`);

        const result = applyPlan(plan, args.source, args.target);

        echo('');
        echo(`Applied: ${result.applied} files`);
        echo(`Skipped: ${result.skipped} files`);

        if (result.errors.length > 0) {
            echoError('Errors:');
            for (const err of result.errors) {
                echoError(`  - ${err}`);
            }
            return 1;
        }

        echo('');
        echo('Migration applied successfully.');
        echo('Run verification: bun install && bun run typecheck && bun run test');

        return 0;
    }

    echoError('Error: specify --analyze or --apply.');
    echoError('Use --help for usage information.');
    return 1;
}

if (import.meta.main) {
    main()
        .then((exitCode) => {
            process.exit(exitCode);
        })
        .catch((error) => {
            echoError(`Fatal error: ${(error as Error).message}`);
            process.exit(1);
        });
}
