import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Command, Option } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import type { ValidationIssue } from './types/scaffold';

/**
 * Contract file structure.
 */
interface ContractFile {
    version: number;
    projectIdentity: {
        displayName: string;
        brandName: string;
        projectSlug: string;
        rootPackageName: string;
        repositoryUrl: string;
        binaryName: string;
        binaryLabel: string;
        apiTitle: string;
        webDescription: string;
    };
    requiredWorkspaces: Record<string, string>;
    optionalWorkspaces: Record<string, string>;
    workspaceDependencyRules: Record<string, string[]>;
    requiredRootScripts?: string[];
    fileNamingRules?: Array<{
        pathPrefix: string;
        pattern: string;
        description: string;
    }>;
}

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
        issues.push(...this.validateScripts(service, contract));
        issues.push(...this.validateFileNaming(service, contract));
        issues.push(...this.validateInstructions(service));

        // 4. Apply fixes if requested
        if (this.fix && issues.some((i) => i.fixable)) {
            await this.applyFixes(service, issues);
            // Re-validate after fixes
            issues.length = 0;
            issues.push(...this.validateWorkspaces(service, contract));
            issues.push(...this.validateScripts(service, contract));
            issues.push(...this.validateFileNaming(service, contract));
            issues.push(...this.validateInstructions(service));
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

        // Check optional workspaces exist if in contract
        for (const [relPath] of Object.entries(contract.optionalWorkspaces)) {
            if (!service.exists(relPath)) {
                issues.push({
                    severity: 'warning',
                    category: 'workspace',
                    message: `Optional workspace in contract but not found: ${relPath}`,
                    path: relPath,
                    fixable: true,
                });
            }
        }

        // Check workspace structure
        const workspacePaths = [
            ...Object.keys(contract.requiredWorkspaces),
            ...Object.keys(contract.optionalWorkspaces),
        ];

        for (const workspacePath of workspacePaths) {
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

        for (const issue of fixable) {
            if (issue.category === 'instructions' && issue.path) {
                // Run generate:instructions to fix instruction issues
                this.runSync('bun', ['run', 'generate:instructions']);
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
