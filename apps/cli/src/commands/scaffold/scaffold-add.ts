import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command, Option } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import { getFeature, isRequiredFeature, REQUIRED_FEATURES, SCAFFOLD_FEATURES } from './features/registry';
import { ScaffoldService } from './services/scaffold-service';

export class ScaffoldAddCommand extends BaseScaffoldCommand {
    constructor() {
        super();
    }

    static override paths = [['scaffold', 'add']];

    static override usage = Command.Usage({
        category: 'Scaffold',
        description: 'Add optional feature modules',
        details: `
            Add optional feature modules to the project.

            Available features:
            - webapp: Astro-based web application (apps/web)
            - server: Hono REST API server (apps/server)
            - cli: Clipanion CLI tool (apps/cli)

            Templates are copied from scripts/scaffold/templates/<feature>/.

            Use 'tbs scaffold list' to see which features are currently installed.
        `,
        examples: [
            ['Add webapp', 'tbs scaffold add webapp'],
            ['Preview webapp addition', 'tbs scaffold add webapp --dry-run'],
            ['JSON mode', 'tbs scaffold add server --json'],
        ],
    });

    feature = Option.String();

    async execute(): Promise<number> {
        const service = new ScaffoldService();

        // 1. Validate feature name
        if (!this.feature) {
            return this.writeOutput(null, 'Feature name is required');
        }

        const featureDef = getFeature(this.feature);
        if (!featureDef) {
            const optionalFeatures = Object.keys(SCAFFOLD_FEATURES).filter(
                (f) => !REQUIRED_FEATURES.includes(f as (typeof REQUIRED_FEATURES)[number]),
            );
            return this.writeOutput(
                null,
                `Unknown feature: ${this.feature}. Available: ${optionalFeatures.join(', ')}`,
            );
        }

        // 2. Check if required feature
        if (isRequiredFeature(this.feature)) {
            return this.writeOutput(null, `Cannot add required feature: ${this.feature} (already included)`);
        }

        // 3. Check if already installed
        if (this.isInstalled(this.feature, service)) {
            return this.writeOutput(null, `Feature '${this.feature}' is already installed`);
        }

        // 4. Check if template exists
        const templateRoot = this.getTemplateRoot(service);
        const templateDir = resolve(templateRoot, this.feature);

        if (!existsSync(templateDir)) {
            return this.writeOutput(
                null,
                `Template for '${this.feature}' not found at ${templateDir}. Run 'bun run generate:scaffold-templates' first.`,
            );
        }

        // 5. Collect files to copy
        const { filesToCopy, dirsToCreate } = this.collectTemplateFiles(service, templateDir);

        // 6. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({
                feature: this.feature,
                filesToCopy,
                dirsToCreate,
                preview: this.formatDryRunOutput(this.feature, filesToCopy, dirsToCreate),
            });
        }

        // 7. Apply changes with rollback on failure
        const createdDirs: string[] = [];
        const copiedFiles: string[] = [];

        try {
            // Create directories first
            for (const dir of dirsToCreate) {
                const absDir = resolve(service.getRoot(), dir);
                if (!existsSync(absDir)) {
                    mkdirSync(absDir, { recursive: true });
                    createdDirs.push(dir);
                }
            }

            // Copy files
            for (const { src, dest } of filesToCopy) {
                const absSrc = resolve(templateDir, src);
                const absDest = resolve(service.getRoot(), dest);
                cpSync(absSrc, absDest, { recursive: true });
                copiedFiles.push(dest);
            }
        } catch (err) {
            // Rollback: remove copied files and created directories
            for (const file of copiedFiles) {
                try {
                    rmSync(resolve(service.getRoot(), file), { recursive: true, force: true });
                } catch {}
            }
            for (const dir of createdDirs.reverse()) {
                try {
                    rmSync(resolve(service.getRoot(), dir), { recursive: true, force: true });
                } catch {}
            }
            return this.writeOutput(null, `Failed to add feature '${this.feature}': ${String(err)}`);
        }

        // 8. Update contracts
        await this.updateContracts(service, this.feature);

        this.writeSuccess(`Feature '${this.feature}' added`);
        return this.writeOutput({
            success: true,
            feature: this.feature,
            filesAdded: filesToCopy.length,
            dirsCreated: dirsToCreate.length,
        });
    }

    /**
     * Get the template root directory.
     */
    private getTemplateRoot(service: ScaffoldService): string {
        // Templates are stored at scripts/scaffold/templates relative to project root
        return resolve(service.getRoot(), 'scripts/scaffold/templates');
    }

    /**
     * Check if a feature is installed.
     */
    private isInstalled(feature: string, service: ScaffoldService): boolean {
        const featureDef = SCAFFOLD_FEATURES[feature];
        if (featureDef?.workspacePath) {
            return service.exists(featureDef.workspacePath);
        }

        return false;
    }

    /**
     * Collect template files to copy.
     * @internal
     */
    public collectTemplateFiles(
        _service: ScaffoldService,
        templateDir: string,
    ): {
        filesToCopy: Array<{ src: string; dest: string }>;
        dirsToCreate: string[];
    } {
        const filesToCopy: Array<{ src: string; dest: string }> = [];
        const dirsToCreate = new Set<string>();

        const walk = (dir: string, relDir: string = ''): void => {
            const entries = readdirSync(dir);
            for (const entry of entries.sort()) {
                const absPath = resolve(dir, entry);
                const stat = statSync(absPath);
                const srcPath = relDir ? `${relDir}/${entry}` : entry;

                if (stat.isDirectory()) {
                    dirsToCreate.add(srcPath);
                    walk(absPath, srcPath);
                } else if (stat.isFile()) {
                    // Map template path to project path
                    // Template: scripts/scaffold/templates/<feature>/apps/cli/src/index.ts
                    // Project: apps/cli/src/index.ts
                    const destPath = srcPath;
                    filesToCopy.push({ src: srcPath, dest: destPath });
                }
            }
        };

        walk(templateDir);
        return { filesToCopy, dirsToCreate: [...dirsToCreate] };
    }

    /**
     * Format the dry-run output.
     * @internal
     */
    public formatDryRunOutput(
        feature: string,
        filesToCopy: Array<{ src: string; dest: string }>,
        dirsToCreate: string[],
    ): string {
        let output = `Would add feature '${feature}':\n\n`;

        if (dirsToCreate.length > 0) {
            output += `Directories to create (${dirsToCreate.length}):\n`;
            for (const dir of dirsToCreate) {
                output += `  + ${dir}/\n`;
            }
            output += '\n';
        }

        if (filesToCopy.length > 0) {
            output += `Files to copy (${filesToCopy.length}):\n`;
            for (const { dest } of filesToCopy) {
                output += `  + ${dest}\n`;
            }
            output += '\n';
        }

        output += 'No changes were made (--dry-run)';
        return output;
    }

    /**
     * Update contracts after adding a feature.
     * @internal
     */
    public async updateContracts(service: ScaffoldService, feature: string): Promise<void> {
        const contractPath = 'contracts/project-contracts.json';
        if (!service.exists(contractPath)) {
            return;
        }

        // Map feature names to workspace paths and package names
        const workspaceMap: Record<string, { path: string; pkg: string }> = {
            cli: { path: 'apps/cli', pkg: '@starter/cli' },
            server: { path: 'apps/server', pkg: '@starter/server' },
            webapp: { path: 'apps/web', pkg: '@starter/web' },
        };

        const featureConfig = workspaceMap[feature];
        if (!featureConfig) {
            return;
        }

        const contract = service.readJson<Record<string, unknown>>(contractPath);
        const optionalWorkspaces = (contract.optionalWorkspaces as Record<string, string>) ?? {};
        if (optionalWorkspaces[featureConfig.path]) {
            return; // Already present
        }

        // Backup before modifying
        const absContractPath = service.resolvePath(contractPath);
        const backupPath = `${absContractPath}.bak`;
        copyFileSync(absContractPath, backupPath);

        try {
            optionalWorkspaces[featureConfig.path] = featureConfig.pkg;
            contract.optionalWorkspaces = optionalWorkspaces;
            service.writeJson(contractPath, contract);
        } catch (err) {
            // Restore backup on failure
            try {
                const content = service.readFile(`${contractPath}.bak`);
                service.writeFile(contractPath, content);
            } catch {}
            throw err;
        } finally {
            // Clean up backup
            try {
                rmSync(backupPath, { force: true });
            } catch {}
        }
    }
}
