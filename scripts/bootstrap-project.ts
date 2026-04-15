#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

interface ProjectIdentity {
    displayName: string;
    brandName: string;
    projectSlug: string;
    rootPackageName: string;
    repositoryUrl: string;
    binaryName: string;
    binaryLabel: string;
    apiTitle: string;
    webDescription: string;
}

interface ContractFile {
    projectIdentity: ProjectIdentity;
    requiredWorkspaces: Record<string, string>;
    optionalWorkspaces: Record<string, string>;
    workspaceDependencyRules: Record<string, string[]>;
}

interface BootstrapOptions {
    name: string;
    title: string;
    brand: string;
    scope: string;
    rootPackageName: string;
    repoUrl: string;
    bin: string;
    dryRun: boolean;
    skipCheck: boolean;
}

const ROOT = resolve(import.meta.dir, '..');
const CONTRACT_PATH = resolve(ROOT, 'contracts/project-contracts.json');
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json');
const IGNORED_DIR_NAMES = new Set(['.astro', '.git', '.wrangler', 'coverage', 'cov', 'dist', 'node_modules']);

const TEXT_FILE_PATHS = collectTextFilePaths();

const options = parseArgs(process.argv.slice(2));
const currentContract = readJson<ContractFile>(CONTRACT_PATH);
const currentIdentity = currentContract.projectIdentity;
const nextIdentity = buildNextIdentity(options);
const currentWorkspaceMap = collectWorkspaceMap(currentContract);
const nextWorkspaceMap = buildNextWorkspaceMap(options.scope);

const replacements = buildReplacementMap(currentIdentity, nextIdentity, currentWorkspaceMap, nextWorkspaceMap);
const pendingWrites = new Map<string, string>();

stageWrite(
    pendingWrites,
    'contracts/project-contracts.json',
    buildUpdatedContractContent(currentContract, nextIdentity, nextWorkspaceMap),
);
stageWrite(pendingWrites, 'package.json', buildUpdatedRootPackageJsonContent(nextIdentity));

for (const relPath of TEXT_FILE_PATHS) {
    const updatedContent = replaceInContent(readFileSync(resolve(ROOT, relPath), 'utf8'), replacements);
    if (updatedContent !== null) {
        stageWrite(pendingWrites, relPath, updatedContent);
    }
}

if (options.dryRun) {
    process.stdout.write('Bootstrap dry run. Files that would change:\n\n');
    for (const relPath of [...pendingWrites.keys()].sort()) {
        process.stdout.write(`- ${relPath}\n`);
    }
    process.stdout.write('\nNo files were written.\n');
    process.exit(0);
}

for (const [relPath, content] of pendingWrites) {
    writeFileSync(resolve(ROOT, relPath), content);
}

runBunScript(['install']);
runBunScript(['run', 'generate:instructions']);
runBiomeFormat([
    'contracts/project-contracts.json',
    'package.json',
    ...TEXT_FILE_PATHS.filter((relPath) => existsSync(resolve(ROOT, relPath))),
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
]);

if (!options.skipCheck) {
    runBunScript(['run', 'check']);
}

process.stdout.write(`Bootstrapped project identity to ${nextIdentity.displayName}\n`);

function parseArgs(args: string[]): BootstrapOptions {
    const values = new Map<string, string>();
    let dryRun = false;
    let skipCheck = false;

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg) {
            break;
        }
        if (arg === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (arg === '--skip-check') {
            skipCheck = true;
            continue;
        }
        if (!arg.startsWith('--')) {
            fail(`unknown argument "${arg}"`);
        }
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
            fail(`missing value for "${arg}"`);
        }
        values.set(arg, value);
        i += 1;
    }

    const rawName = values.get('--name');
    if (!rawName) {
        fail('missing required argument "--name"');
    }

    const name = slugify(rawName);
    const title = values.get('--title') ?? toTitleCase(name);
    const brand = values.get('--brand') ?? title;
    const scope = normalizeScope(values.get('--scope') ?? `@${name}`);
    const rootPackageName = values.get('--root-package-name') ?? `${scope}/${name}`;
    const repoUrl = values.get('--repo-url') ?? `https://github.com/${scope.slice(1)}/${name}`;
    const bin = slugify(values.get('--bin') ?? name);

    return {
        name,
        title,
        brand,
        scope,
        rootPackageName,
        repoUrl,
        bin,
        dryRun,
        skipCheck,
    };
}

function buildNextIdentity(options: BootstrapOptions): ProjectIdentity {
    return {
        displayName: options.title,
        brandName: options.brand,
        projectSlug: options.name,
        rootPackageName: options.rootPackageName,
        repositoryUrl: options.repoUrl,
        binaryName: options.bin,
        binaryLabel: options.title,
        apiTitle: `${options.title} API`,
        webDescription: `${options.title} WebApp`,
    };
}

function collectWorkspaceMap(contract: ContractFile): Record<string, string> {
    return {
        ...contract.requiredWorkspaces,
        ...contract.optionalWorkspaces,
    };
}

function buildNextWorkspaceMap(scope: string): Record<string, string> {
    return {
        'packages/core': `${scope}/core`,
        'apps/cli': `${scope}/cli`,
        'apps/server': `${scope}/server`,
        'apps/web': `${scope}/web`,
    };
}

function buildReplacementMap(
    currentIdentity: ProjectIdentity,
    nextIdentity: ProjectIdentity,
    currentWorkspaceMap: Record<string, string>,
    nextWorkspaceMap: Record<string, string>,
): Array<[string, string]> {
    const currentCorePackage = requiredRecordValue(currentWorkspaceMap, 'packages/core');
    const currentCliPackage = requiredRecordValue(currentWorkspaceMap, 'apps/cli');
    const currentServerPackage = requiredRecordValue(currentWorkspaceMap, 'apps/server');
    const currentWebPackage = requiredRecordValue(currentWorkspaceMap, 'apps/web');
    const nextCorePackage = requiredRecordValue(nextWorkspaceMap, 'packages/core');
    const nextCliPackage = requiredRecordValue(nextWorkspaceMap, 'apps/cli');
    const nextServerPackage = requiredRecordValue(nextWorkspaceMap, 'apps/server');
    const nextWebPackage = requiredRecordValue(nextWorkspaceMap, 'apps/web');

    return [
        [currentIdentity.displayName, nextIdentity.displayName],
        [currentIdentity.brandName, nextIdentity.brandName],
        [currentIdentity.rootPackageName, nextIdentity.rootPackageName],
        [currentIdentity.repositoryUrl, nextIdentity.repositoryUrl],
        [currentIdentity.binaryLabel, nextIdentity.binaryLabel],
        [currentIdentity.binaryName, nextIdentity.binaryName],
        [currentIdentity.apiTitle, nextIdentity.apiTitle],
        [currentIdentity.webDescription, nextIdentity.webDescription],
        [currentIdentity.projectSlug, nextIdentity.projectSlug],
        [currentCorePackage, nextCorePackage],
        [currentCliPackage, nextCliPackage],
        [currentServerPackage, nextServerPackage],
        [currentWebPackage, nextWebPackage],
    ];
}

function buildUpdatedContractContent(
    contract: ContractFile,
    nextIdentity: ProjectIdentity,
    nextWorkspaceMap: Record<string, string>,
): string {
    const nextCorePackage = requiredRecordValue(nextWorkspaceMap, 'packages/core');
    const nextCliPackage = requiredRecordValue(nextWorkspaceMap, 'apps/cli');
    const nextServerPackage = requiredRecordValue(nextWorkspaceMap, 'apps/server');
    const nextWebPackage = requiredRecordValue(nextWorkspaceMap, 'apps/web');
    const nextWorkspaceDependencyRules: Record<string, string[]> = {
        [nextCorePackage]: [],
        [nextCliPackage]: [nextCorePackage],
        [nextServerPackage]: [nextCorePackage],
        [nextWebPackage]: [nextCorePackage],
    };

    contract.projectIdentity = nextIdentity;
    contract.requiredWorkspaces['packages/core'] = nextCorePackage;
    contract.optionalWorkspaces['apps/cli'] = nextCliPackage;
    contract.optionalWorkspaces['apps/server'] = nextServerPackage;
    contract.optionalWorkspaces['apps/web'] = nextWebPackage;
    contract.workspaceDependencyRules = nextWorkspaceDependencyRules;
    return `${JSON.stringify(contract, null, 4)}\n`;
}

function buildUpdatedRootPackageJsonContent(nextIdentity: ProjectIdentity): string {
    const packageJson = readJson<Record<string, unknown>>(PACKAGE_JSON_PATH);
    packageJson.name = nextIdentity.rootPackageName;
    const scripts = (packageJson.scripts ?? {}) as Record<string, string>;
    scripts.bootstrap = 'bun run scripts/bootstrap-project.ts';
    packageJson.scripts = scripts;
    return `${JSON.stringify(packageJson, null, 4)}\n`;
}

function replaceInContent(content: string, replacements: Array<[string, string]>): string | null {
    let updated = content;
    for (const [from, to] of replacements) {
        if (!from || from === to) {
            continue;
        }
        updated = updated.split(from).join(to);
    }
    return updated === content ? null : updated;
}

function runBunScript(args: string[]): void {
    const proc = Bun.spawnSync({
        cmd: ['bun', ...args],
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
    });

    if (proc.exitCode !== 0) {
        process.exit(proc.exitCode ?? 1);
    }
}

function stageWrite(pending: Map<string, string>, relPath: string, content: string): void {
    const absPath = resolve(ROOT, relPath);
    const existing = existsSync(absPath) ? readFileSync(absPath, 'utf8') : null;
    if (existing !== null) {
        if (existing === content) {
            return;
        }
        if (isJsonFile(relPath) && jsonEquals(existing, content)) {
            return;
        }
    }
    pending.set(relPath, content);
}

function runBiomeFormat(paths: string[]): void {
    const uniquePaths = [...new Set(paths)].filter((relPath) => existsSync(resolve(ROOT, relPath)));
    const proc = Bun.spawnSync({
        cmd: ['./node_modules/.bin/biome', 'format', '--write', ...uniquePaths],
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
    });

    if (proc.exitCode !== 0) {
        process.exit(proc.exitCode ?? 1);
    }
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function normalizeScope(scope: string): string {
    if (!scope.startsWith('@')) {
        return `@${slugify(scope)}`;
    }
    return `@${slugify(scope.slice(1))}`;
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toTitleCase(value: string): string {
    return value
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function fail(message: string): never {
    process.stderr.write(`${message}\n`);
    process.stderr.write(
        'Usage: bun run bootstrap -- --name <project-slug> [--title <display-name>] [--brand <short-brand>] [--scope <workspace-scope>] [--root-package-name <pkg>] [--repo-url <url>] [--bin <binary-name>] [--dry-run] [--skip-check]\n',
    );
    process.exit(1);
}

function collectTextFilePaths(): string[] {
    const results = new Set<string>();
    const roots = ['apps', 'packages', 'scripts'];

    for (const rootDir of roots) {
        const absRoot = resolve(ROOT, rootDir);
        if (!existsSync(absRoot)) {
            continue;
        }
        for (const absPath of collectFiles(absRoot)) {
            if (isTextFile(absPath)) {
                results.add(relative(ROOT, absPath));
            }
        }
    }

    const docFiles = ['docs/01_ARCHITECTURE_SPEC.md', 'docs/02_DEVELOPER_SPEC.md', 'docs/03_USER_MANUAL.md'];
    for (const relPath of ['README.md', 'CHANGELOG.md', ...docFiles]) {
        if (existsSync(resolve(ROOT, relPath))) {
            results.add(relPath);
        }
    }

    return [...results].sort();
}

function collectFiles(dir: string): string[] {
    const results: string[] = [];

    for (const entry of readdirSync(dir).sort()) {
        if (IGNORED_DIR_NAMES.has(entry)) {
            continue;
        }

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (
                fullPath.includes('/docs/tasks') ||
                fullPath.includes('/docs/.tasks') ||
                fullPath.includes('/docs/.workflow-runs')
            ) {
                continue;
            }
            results.push(...collectFiles(fullPath));
            continue;
        }
        results.push(fullPath);
    }

    return results;
}

function isTextFile(path: string): boolean {
    return /\.(?:md|json|ts|tsx|astro)$/.test(path);
}

function isJsonFile(path: string): boolean {
    return path.endsWith('.json') || path.endsWith('package.json');
}

function jsonEquals(left: string, right: string): boolean {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
}

function requiredRecordValue(record: Record<string, string>, key: string): string {
    const value = record[key];
    if (!value) {
        fail(`missing required contract key "${key}"`);
    }
    return value;
}
