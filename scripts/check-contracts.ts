#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import contract from '../contracts/project-contracts.json';

interface PackageJson {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
}

interface Failure {
    path: string;
    message: string;
}

interface NamingRule {
    pathPrefix: string;
    pattern: string;
    description: string;
}

const ROOT = resolve(import.meta.dir, '..');
const PACKAGE_JSON_PATH = join(ROOT, 'package.json');
const ROOT_PACKAGE_JSON = readJson<PackageJson>(PACKAGE_JSON_PATH);
const IGNORED_DIR_NAMES = new Set(['.astro', '.git', '.wrangler', 'coverage', 'cov', 'dist', 'node_modules']);
const WORKSPACE_DEPENDENCY_RULES = contract.workspaceDependencyRules as Record<string, string[]>;
const WORKSPACE_PACKAGE_NAMES = [
    ...Object.values(contract.requiredWorkspaces),
    ...Object.values(contract.optionalWorkspaces),
].sort((left, right) => right.length - left.length);

const FAILURES: Failure[] = [];

checkRootScripts();
checkWorkspaces();
checkForbiddenTestLocations();
checkFileNaming();

if (FAILURES.length > 0) {
    writeStderr(`Contract check failed with ${FAILURES.length} issue(s).\n\n`);
    for (const failure of FAILURES) {
        writeStderr(`- ${failure.path}: ${failure.message}\n`);
    }
    process.exit(1);
}

writeStdout('Contract check passed\n');

function checkRootScripts(): void {
    for (const scriptName of contract.requiredRootScripts) {
        if (!ROOT_PACKAGE_JSON.scripts?.[scriptName]) {
            addFailure('package.json', `missing required root script "${scriptName}"`);
        }
    }
}

function checkWorkspaces(): void {
    for (const [workspaceDir, expectedName] of Object.entries(contract.requiredWorkspaces)) {
        checkWorkspace(workspaceDir, expectedName, true);
    }

    for (const [workspaceDir, expectedName] of Object.entries(contract.optionalWorkspaces)) {
        if (existsSync(join(ROOT, workspaceDir))) {
            checkWorkspace(workspaceDir, expectedName, false);
        }
    }

    for (const workspaceDir of findWorkspaceDirectories('apps')) {
        if (!(workspaceDir in contract.optionalWorkspaces)) {
            addFailure(workspaceDir, 'workspace is not part of the approved starter app tiers');
        }
    }

    for (const workspaceDir of findWorkspaceDirectories('packages')) {
        if (!(workspaceDir in contract.requiredWorkspaces)) {
            addFailure(workspaceDir, 'workspace is not part of the approved starter package tiers');
        }
    }
}

function checkWorkspace(workspaceDir: string, expectedName: string, required: boolean): void {
    const packageJsonPath = join(ROOT, workspaceDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
        if (required) {
            addFailure(workspaceDir, 'required workspace is missing package.json');
        }
        return;
    }

    const packageJson = readJson<PackageJson>(packageJsonPath);
    if (packageJson.name !== expectedName) {
        addFailure(`${workspaceDir}/package.json`, `expected package name "${expectedName}"`);
    }

    const allowedLocalDeps = new Set([expectedName, ...(WORKSPACE_DEPENDENCY_RULES[expectedName] ?? [])]);

    for (const [depName, depVersion] of Object.entries(collectDependencyMap(packageJson))) {
        if (!WORKSPACE_PACKAGE_NAMES.includes(depName)) {
            continue;
        }

        if (!allowedLocalDeps.has(depName)) {
            addFailure(
                `${workspaceDir}/package.json`,
                `workspace dependency "${depName}" is outside the allowed boundary`,
            );
        }

        if (depName !== expectedName && depVersion !== 'workspace:*') {
            addFailure(`${workspaceDir}/package.json`, `workspace dependency "${depName}" must use "workspace:*"`);
        }
    }

    checkSourceImports(workspaceDir, expectedName, allowedLocalDeps);
}

function checkSourceImports(workspaceDir: string, workspaceName: string, allowedLocalDeps: Set<string>): void {
    const srcDir = join(ROOT, workspaceDir, 'src');
    if (!existsSync(srcDir)) {
        return;
    }

    for (const absPath of collectFiles(srcDir)) {
        if (!isSourceFile(absPath)) {
            continue;
        }

        const relPath = relative(ROOT, absPath);
        for (const specifier of extractImportSpecifiers(readFileSync(absPath, 'utf8'))) {
            const packageName = getWorkspacePackageName(specifier);
            if (!packageName) {
                continue;
            }

            if (packageName === workspaceName) {
                continue;
            }

            if (!allowedLocalDeps.has(packageName)) {
                addFailure(relPath, `imports "${specifier}" across a forbidden workspace boundary`);
            }
        }
    }
}

function checkForbiddenTestLocations(): void {
    for (const rootDir of ['apps', 'packages']) {
        const absRoot = join(ROOT, rootDir);
        if (!existsSync(absRoot)) {
            continue;
        }

        for (const absPath of collectFiles(absRoot)) {
            const relPath = relative(ROOT, absPath);
            if (relPath.includes('/__tests__/')) {
                addFailure(relPath, '__tests__ directories are forbidden; use tests/ at package root');
            }

            if (relPath.includes('/src/') && /\.(test|spec)\.[^.]+$/.test(relPath)) {
                addFailure(relPath, 'test files must not live under src/');
            }
        }
    }
}

function checkFileNaming(): void {
    const namingRules = contract.fileNamingRules as NamingRule[];

    for (const rule of namingRules) {
        const absPrefix = join(ROOT, rule.pathPrefix);
        if (!existsSync(absPrefix)) {
            continue;
        }

        const pattern = new RegExp(rule.pattern);
        for (const absPath of collectFiles(absPrefix)) {
            const relPath = relative(ROOT, absPath);
            const fileName = basename(absPath);
            if (!pattern.test(fileName)) {
                addFailure(relPath, rule.description);
            }
        }
    }
}

function findWorkspaceDirectories(rootDir: 'apps' | 'packages'): string[] {
    const absRoot = join(ROOT, rootDir);
    if (!existsSync(absRoot)) {
        return [];
    }

    return readdirSync(absRoot)
        .map((entry) => join(rootDir, entry))
        .filter((relPath) => existsSync(join(ROOT, relPath, 'package.json')))
        .sort();
}

function collectDependencyMap(packageJson: PackageJson): Record<string, string> {
    return {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
        ...(packageJson.peerDependencies ?? {}),
        ...(packageJson.optionalDependencies ?? {}),
    };
}

function getWorkspacePackageName(specifier: string): string | null {
    for (const packageName of WORKSPACE_PACKAGE_NAMES) {
        if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
            return packageName;
        }
    }
    return null;
}

function collectFiles(dir: string): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) {
        return results;
    }

    for (const entry of readdirSync(dir).sort()) {
        if (IGNORED_DIR_NAMES.has(entry)) {
            continue;
        }

        const fullPath = join(dir, entry);
        let stat: ReturnType<typeof statSync>;
        try {
            stat = statSync(fullPath);
        } catch {
            continue;
        }

        if (stat.isDirectory()) {
            results.push(...collectFiles(fullPath));
            continue;
        }
        results.push(fullPath);
    }

    return results;
}

function isSourceFile(absPath: string): boolean {
    return /\.(?:ts|tsx|astro)$/.test(absPath) && !absPath.endsWith('.d.ts');
}

function extractImportSpecifiers(source: string): string[] {
    const specifiers = new Set<string>();
    const patterns = [/from\s+["']([^"']+)["']/g, /import\s*\(\s*["']([^"']+)["']\s*\)/g];

    for (const pattern of patterns) {
        let match: RegExpExecArray | null = null;
        while (true) {
            match = pattern.exec(source);
            if (match === null) {
                break;
            }
            const specifier = match[1];
            if (specifier) {
                specifiers.add(specifier);
            }
        }
    }

    return [...specifiers];
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function addFailure(path: string, message: string): void {
    FAILURES.push({ path, message });
}

function writeStdout(message: string): void {
    process.stdout.write(message);
}

function writeStderr(message: string): void {
    process.stderr.write(message);
}
