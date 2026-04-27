import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cwd } from 'node:process';
import { echoError } from '@starter/core';
import { writeOutput } from '../../ui/output';
import { SCAFFOLD_FEATURES } from './features/registry';
import { ScaffoldService } from './services/scaffold-service';
import type { ContractFile, ValidationIssue } from './types/scaffold';

// ---------------------------------------------------------------------------
// Action (invoked by commander wiring in scaffold/index.ts)
// ---------------------------------------------------------------------------

export interface ValidateActionOpts {
    fix?: boolean;
    dryRun?: boolean;
    json?: boolean;
}

export async function scaffoldValidateAction(
    opts: ValidateActionOpts,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    const isJson = opts.json ?? false;
    const service = new ScaffoldService();
    const issues: ValidationIssue[] = [];

    if (!service.exists('contracts/project-contracts.json')) {
        process.exitCode = writeOutput(out, err, isJson, null, 'contracts/project-contracts.json not found');
        return;
    }

    const contract = service.readJson<ContractFile>('contracts/project-contracts.json');

    issues.push(...validateWorkspaces(service, contract));
    issues.push(...validateDependencyRules(service, contract));
    issues.push(...validateScripts(service, contract));
    issues.push(...validateFileNaming(service, contract));
    issues.push(...validateInstructions(service));

    if (opts.fix && issues.some((i) => i.fixable)) {
        const fixableCategories = new Set(issues.filter((i) => i.fixable).map((i) => i.category));
        applyValidateFixes(issues, err);
        issues.length = 0;
        if (fixableCategories.has('workspace')) {
            issues.push(...validateWorkspaces(service, contract));
        }
        if (fixableCategories.has('workspace')) {
            issues.push(...validateDependencyRules(service, contract));
        }
        if (fixableCategories.has('script')) {
            issues.push(...validateScripts(service, contract));
        }
        if (fixableCategories.has('naming')) {
            issues.push(...validateFileNaming(service, contract));
        }
        if (fixableCategories.has('instructions')) {
            issues.push(...validateInstructions(service));
        }
    }

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    if (issues.length === 0) {
        writeOutput(out, err, isJson, { valid: true, message: 'Project validation passed' });
        return;
    }

    const fixableCount = issues.filter((i) => i.fixable).length;
    writeOutput(
        out,
        err,
        isJson,
        {
            valid: errors.length === 0,
            errors: errors.length,
            warnings: warnings.length,
            issues,
            hint: fixableCount > 0 ? `Run with --fix to auto-fix ${fixableCount} issue(s)` : undefined,
        },
        errors.length > 0 ? `Validation failed with ${errors.length} error(s)` : undefined,
    );
}

// ---------------------------------------------------------------------------
// Module-level functions (exported for testing)
// ---------------------------------------------------------------------------

export function validateWorkspaces(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [relPath] of Object.entries(contract.requiredWorkspaces)) {
        if (!service.exists(relPath)) {
            issues.push({
                severity: 'error',
                category: 'workspace',
                message: `Required workspace missing: ${relPath}`,
                path: relPath,
                fixable: false,
            });
        }
    }

    const existingWorkspacePaths: string[] = [];

    for (const [relPath] of Object.entries(contract.optionalWorkspaces)) {
        if (!service.exists(relPath)) {
            issues.push({
                severity: 'warning',
                category: 'workspace',
                message: `Optional workspace in contract but not found: ${relPath}`,
                path: relPath,
                fixable: false,
            });
        } else {
            existingWorkspacePaths.push(relPath);
        }
    }

    for (const [relPath] of Object.entries(contract.requiredWorkspaces)) {
        if (service.exists(relPath)) {
            existingWorkspacePaths.push(relPath);
        }
    }

    for (const workspacePath of existingWorkspacePaths) {
        const pkgJsonPath = `${workspacePath}/package.json`;
        if (!service.exists(pkgJsonPath)) {
            issues.push({
                severity: 'error',
                category: 'workspace',
                message: `Workspace missing package.json: ${pkgJsonPath}`,
                path: pkgJsonPath,
                fixable: false,
            });
        }
    }

    const declaredWorkspaces = new Set([
        ...Object.keys(contract.requiredWorkspaces),
        ...Object.keys(contract.optionalWorkspaces),
    ]);

    for (const feature of Object.values(SCAFFOLD_FEATURES)) {
        if (!feature.workspacePath || !service.exists(feature.workspacePath)) {
            continue;
        }

        if (!declaredWorkspaces.has(feature.workspacePath)) {
            issues.push({
                severity: 'error',
                category: 'workspace',
                message: `Workspace exists on disk but is missing from contract: ${feature.workspacePath}`,
                path: feature.workspacePath,
                fixable: false,
            });
        }
    }

    return issues;
}

export function validateDependencyRules(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!contract.workspaceDependencyRules) {
        return issues;
    }

    const allWorkspaces: Record<string, string> = {
        ...contract.requiredWorkspaces,
        ...contract.optionalWorkspaces,
    };

    const workspacePackageNames = new Set(Object.values(allWorkspaces));

    for (const [workspacePath, packageName] of Object.entries(allWorkspaces)) {
        const pkgJsonPath = `${workspacePath}/package.json`;
        if (!service.exists(pkgJsonPath)) {
            continue;
        }

        const pkgJson = service.readJson<{
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        }>(pkgJsonPath);

        const allDeps = {
            ...pkgJson.dependencies,
            ...pkgJson.devDependencies,
        };

        const allowed = contract.workspaceDependencyRules[packageName];
        if (!allowed) {
            continue;
        }

        const allowedSet = new Set(allowed);

        for (const dep of Object.keys(allDeps)) {
            if (workspacePackageNames.has(dep) && !allowedSet.has(dep)) {
                issues.push({
                    severity: 'error',
                    category: 'workspace',
                    message: `Workspace ${packageName} depends on ${dep} but it is not in allowed dependencies: [${allowed.join(', ')}]`,
                    path: pkgJsonPath,
                    fixable: false,
                });
            }
        }
    }

    return issues;
}

export function validateScripts(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!contract.requiredRootScripts) {
        return issues;
    }

    const packageJson = service.readJson<{ scripts?: Record<string, string> }>('package.json');
    const scripts = packageJson.scripts ?? {};

    for (const required of contract.requiredRootScripts) {
        if (!scripts[required]) {
            issues.push({
                severity: 'error',
                category: 'script',
                message: `Required script missing: ${required}`,
                fixable: false,
            });
        }
    }

    return issues;
}

export function validateFileNaming(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!contract.fileNamingRules) {
        return issues;
    }

    for (const rule of contract.fileNamingRules) {
        const absPrefix = resolve(service.getRoot(), rule.pathPrefix);
        if (!existsSync(absPrefix)) {
            continue;
        }

        const files = listValidateFiles(absPrefix);
        const pattern = new RegExp(rule.pattern);

        for (const file of files) {
            const relPath = relative(service.getRoot(), file);
            const fileName = relPath.split('/').pop() ?? '';

            if (!pattern.test(fileName)) {
                issues.push({
                    severity: 'warning',
                    category: 'naming',
                    message: `File ${relPath} does not match pattern: ${rule.description}`,
                    path: relPath,
                    fixable: false,
                });
            }
        }
    }

    return issues;
}

export function validateInstructions(service: ScaffoldService): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!service.exists('AGENTS.md')) {
        issues.push({
            severity: 'warning',
            category: 'instructions',
            message: 'AGENTS.md is missing. Run "bun run generate:instructions" to generate.',
            path: 'AGENTS.md',
            fixable: true,
        });
    }

    if (!service.exists('CLAUDE.md')) {
        issues.push({
            severity: 'warning',
            category: 'instructions',
            message: 'CLAUDE.md is missing. Run "bun run generate:instructions" to generate.',
            path: 'CLAUDE.md',
            fixable: true,
        });
    }

    return issues;
}

export function listValidateFiles(dir: string): string[] {
    const results: string[] = [];
    const ignored = new Set(['node_modules', '.git', 'coverage', 'dist', '.astro']);

    const walk = (currentDir: string): void => {
        if (!existsSync(currentDir)) {
            return;
        }

        for (const entry of readdirSync(currentDir).sort()) {
            if (ignored.has(entry)) {
                continue;
            }

            const absPath = join(currentDir, entry);
            const stat = statSync(absPath);

            if (stat.isDirectory()) {
                walk(absPath);
            } else if (stat.isFile()) {
                results.push(absPath);
            }
        }
    };

    walk(dir);
    return results;
}

export function applyValidateFixes(issues: ValidationIssue[], stderr: NodeJS.WritableStream = process.stderr): void {
    const fixable = issues.filter((i) => i.fixable);
    const fixedCategories = new Set<string>();

    for (const issue of fixable) {
        if (issue.category === 'instructions' && !fixedCategories.has('instructions')) {
            runValidateSync('bun', ['run', 'generate:instructions'], stderr);
            fixedCategories.add('instructions');
        }
    }
}

export function runValidateSync(cmd: string, args: string[], stderr: NodeJS.WritableStream = process.stderr): void {
    const result = spawnSync(cmd, args, {
        cwd: cwd(),
        stdio: 'pipe',
    });
    const label = `${cmd} ${args.join(' ')}`.trim();
    if (result.error) {
        echoError(`Warning: "${label}" failed to start: ${result.error.message}`, stderr);
        return;
    }
    const status = result.status ?? 1;
    if (status !== 0) {
        echoError(`Warning: "${label}" exited with code ${status}.`, stderr);
    }
}
