import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Command, Option } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import { SCAFFOLD_FEATURES } from './features/registry';
import { ScaffoldService } from './services/scaffold-service';
import type { ContractFile, ValidationIssue } from './types/scaffold';

export class ScaffoldValidateCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'validate']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Validate project contracts and structure',
        details: `
            Validate that the project follows all contracts:
            - Required workspaces exist
            - Optional workspaces match contract
            - Workspace dependency rules are respected
            - Root scripts are present
            - File naming rules are followed
            - Instruction files are in sync

            Use --fix to automatically fix fixable issues.
        `,
        examples: [
            ['Validate project', 'tbs scaffold validate'],
            ['Validate with auto-fix', 'tbs scaffold validate --fix'],
            ['JSON output', 'tbs scaffold validate --json'],
        ],
    });

    fix = Option.Boolean('--fix', false, {
        description: 'Auto-fix fixable issues',
    });

    async execute(): Promise<number> {
        const service = new ScaffoldService();
        const issues: ValidationIssue[] = [];

        // 1. Check if contract exists
        if (!service.exists('contracts/project-contracts.json')) {
            return this.writeOutput(null, 'contracts/project-contracts.json not found');
        }

        // 2. Load contract
        const contract = service.readJson<ContractFile>('contracts/project-contracts.json');

        // 3. Run validations
        issues.push(...this.validateWorkspaces(service, contract));
        issues.push(...this.validateDependencyRules(service, contract));
        issues.push(...this.validateScripts(service, contract));
        issues.push(...this.validateFileNaming(service, contract));
        issues.push(...this.validateInstructions(service));

        // 4. Apply fixes if requested
        if (this.fix && issues.some((i) => i.fixable)) {
            const fixableCategories = new Set(issues.filter((i) => i.fixable).map((i) => i.category));
            await this.applyFixes(service, issues);
            // Re-validate only categories that had fixable issues
            issues.length = 0;
            if (fixableCategories.has('workspace')) {
                issues.push(...this.validateWorkspaces(service, contract));
            }
            if (fixableCategories.has('workspace')) {
                issues.push(...this.validateDependencyRules(service, contract));
            }
            if (fixableCategories.has('script')) {
                issues.push(...this.validateScripts(service, contract));
            }
            if (fixableCategories.has('naming')) {
                issues.push(...this.validateFileNaming(service, contract));
            }
            if (fixableCategories.has('instructions')) {
                issues.push(...this.validateInstructions(service));
            }
        }

        // 5. Output results
        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');

        if (issues.length === 0) {
            return this.writeOutput({
                valid: true,
                message: 'Project validation passed',
            });
        }

        const fixableCount = issues.filter((i) => i.fixable).length;
        return this.writeOutput(
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

    /**
     * Validate workspace structure.
     */
    private validateWorkspaces(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check required workspaces exist
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

        // Track which workspaces exist for package.json / dependency checks
        const existingWorkspacePaths: string[] = [];

        // Check optional workspaces exist if in contract
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

        // Required workspaces that exist are also eligible for package.json / dependency checks
        for (const [relPath] of Object.entries(contract.requiredWorkspaces)) {
            if (service.exists(relPath)) {
                existingWorkspacePaths.push(relPath);
            }
        }

        // Check package.json only for workspaces that exist on disk
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

    /**
     * Validate workspace dependency rules.
     * Checks that workspace package.json dependencies conform to
     * the allowed dependency rules in the contract.
     */
    private validateDependencyRules(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        if (!contract.workspaceDependencyRules) {
            return issues;
        }

        // Map: workspace path -> package name
        const allWorkspaces: Record<string, string> = {
            ...contract.requiredWorkspaces,
            ...contract.optionalWorkspaces,
        };

        // Set of all known workspace package names for fast lookup
        const workspacePackageNames = new Set(Object.values(allWorkspaces));

        for (const [workspacePath, packageName] of Object.entries(allWorkspaces)) {
            const pkgJsonPath = `${workspacePath}/package.json`;
            if (!service.exists(pkgJsonPath)) {
                continue; // Already reported by validateWorkspaces
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

            // If no rules defined for this workspace, skip
            if (!allowed) {
                continue;
            }

            const allowedSet = new Set(allowed);

            for (const dep of Object.keys(allDeps)) {
                // Only check workspace-internal deps (those known to the contract)
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

    /**
     * Validate root scripts.
     */
    private validateScripts(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
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

    /**
     * Validate file naming conventions.
     */
    private validateFileNaming(service: ScaffoldService, contract: ContractFile): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        if (!contract.fileNamingRules) {
            return issues;
        }

        for (const rule of contract.fileNamingRules) {
            const absPrefix = resolve(service.getRoot(), rule.pathPrefix);
            if (!existsSync(absPrefix)) {
                continue;
            }

            const files = this.listFiles(absPrefix);
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

    /**
     * Validate instruction files are in sync.
     */
    private validateInstructions(service: ScaffoldService): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check AGENTS.md exists
        if (!service.exists('AGENTS.md')) {
            issues.push({
                severity: 'warning',
                category: 'instructions',
                message: 'AGENTS.md is missing. Run "bun run generate:instructions" to generate.',
                path: 'AGENTS.md',
                fixable: true,
            });
        }

        // Check CLAUDE.md exists
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

    /**
     * List all files in a directory recursively.
     */
    private listFiles(dir: string): string[] {
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

    /**
     * Apply auto-fixes for fixable issues.
     */
    private async applyFixes(_service: ScaffoldService, issues: ValidationIssue[]): Promise<void> {
        const fixable = issues.filter((i) => i.fixable);

        // Deduplicate: only run each fix action once per category
        const fixedCategories = new Set<string>();

        for (const issue of fixable) {
            if (issue.category === 'instructions' && !fixedCategories.has('instructions')) {
                // Run generate:instructions to fix instruction issues
                this.runSync('bun', ['run', 'generate:instructions']);
                fixedCategories.add('instructions');
            }
        }
    }

    /**
     * Run a synchronous command.
     */
    private runSync(cmd: string, args: string[]): void {
        spawnSync(cmd, args, {
            cwd: process.cwd(),
            stdio: 'inherit',
        });
    }
}
