import { Command, Option } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import {
    BASELINE_FILES,
    getFeature,
    isRequiredFeature,
    REQUIRED_FEATURES,
    SCAFFOLD_FEATURES,
} from './features/registry';
import { ScaffoldService } from './services/scaffold-service';
import type { FeatureDefinition } from './types/scaffold';

export class ScaffoldRemoveCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'remove']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Remove optional feature modules',
        details: `
            Remove optional feature modules from the project.

            Available features:
            - skills: Skill management domain (SkillService, CRUD commands)
            - webapp: Astro-based web application (apps/web)
            - api: Hono REST API server (apps/server)
            - cli: Clipanion CLI tool (apps/cli)

            Warning: Removing a feature also removes all associated tests.

            Use 'tbs scaffold list' to see which features are currently installed.
        `,
        examples: [
            ['Remove skills domain', 'tbs scaffold remove skills'],
            ['Preview webapp removal', 'tbs scaffold remove webapp --dry-run'],
            ['JSON mode', 'tbs scaffold remove api --json'],
        ],
    });

    feature = Option.String();

    async execute(): Promise<number> {
        const service = new ScaffoldService();

        const featureDef = getFeature(this.feature);
        if (!featureDef) {
            const optionalFeatures = Object.keys(SCAFFOLD_FEATURES).filter(
                (f) => !REQUIRED_FEATURES.includes(f as (typeof REQUIRED_FEATURES)[number]),
            );
            const available = [...REQUIRED_FEATURES, ...optionalFeatures].join(', ');
            return this.writeOutput(null, `Unknown feature: ${this.feature}. Available: ${available}`);
        }

        // 2. Check if required feature
        if (isRequiredFeature(this.feature)) {
            return this.writeOutput(null, `Cannot remove required feature: ${this.feature}`);
        }

        // 3. Check if feature exists (is installed)
        if (!this.isInstalled(this.feature, service)) {
            return this.writeOutput(null, `Feature '${this.feature}' is not installed`);
        }

        // 4. Stage changes
        const { filesToDelete, filesToRewrite } = this.stageChanges(service, featureDef);

        // 5. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({
                feature: this.feature,
                filesToDelete,
                filesToRewrite,
                preview: this.formatDryRunOutput(this.feature, filesToDelete, filesToRewrite),
            });
        }

        // 6. Apply changes
        for (const relPath of filesToDelete) {
            service.deleteFile(relPath);
        }

        for (const [relPath, content] of filesToRewrite) {
            service.writeFile(relPath, content);
        }

        // 7. Update contracts if needed
        await this.updateContracts(service, this.feature);
        this.runPostRemoveScripts(service);

        this.writeSuccess(`Feature '${this.feature}' removed`);
        return this.writeOutput({
            success: true,
            feature: this.feature,
            filesDeleted: filesToDelete.length,
            filesRewritten: filesToRewrite.length,
        });
    }

    /**
     * Check if a feature is installed (exists in project).
     */
    private isInstalled(feature: string, service: ScaffoldService): boolean {
        // For skills, check multiple key files to avoid false positives
        if (feature === 'skills') {
            return (
                service.exists('packages/core/src/services/skill-service.ts') &&
                service.exists('packages/core/src/schemas/skill.ts')
            );
        }

        // For apps, check the workspace path
        const featureDef = SCAFFOLD_FEATURES[feature];
        if (featureDef?.workspacePath) {
            return service.exists(featureDef.workspacePath);
        }

        return false;
    }

    /**
     * Stage file deletions and rewrites for the feature removal.
     */
    private stageChanges(
        service: ScaffoldService,
        featureDef: FeatureDefinition,
    ): {
        filesToDelete: string[];
        filesToRewrite: Array<[string, string]>;
    } {
        const filesToDelete: string[] = [];
        const filesToRewrite: Array<[string, string]> = [];

        // 1. Collect files to delete
        for (const file of featureDef.files) {
            if (service.exists(file)) {
                filesToDelete.push(file);
            }
        }

        // 2. For skills, we need to rewrite certain files to strip references
        if (this.feature === 'skills') {
            for (const [relPath, baselineContent] of Object.entries(BASELINE_FILES)) {
                if (service.exists(relPath)) {
                    filesToRewrite.push([relPath, baselineContent]);
                    // Remove from delete list if it's in there
                    const idx = filesToDelete.indexOf(relPath);
                    if (idx !== -1) {
                        filesToDelete.splice(idx, 1);
                    }
                }
            }
        }

        return { filesToDelete, filesToRewrite };
    }

    /**
     * Format the dry-run output.
     */
    private formatDryRunOutput(
        feature: string,
        filesToDelete: string[],
        filesToRewrite: Array<[string, string]>,
    ): string {
        let output = `Would remove feature '${feature}':\n\n`;

        if (filesToDelete.length > 0) {
            output += `Files to delete (${filesToDelete.length}):\n`;
            for (const file of filesToDelete) {
                output += `  - ${file}\n`;
            }
            output += '\n';
        }

        if (filesToRewrite.length > 0) {
            output += `Files to rewrite (${filesToRewrite.length}):\n`;
            for (const [file] of filesToRewrite) {
                output += `  ~ ${file}\n`;
            }
            output += '\n';
        }

        output += 'No changes were made (--dry-run)';
        return output;
    }

    /**
     * Update contracts/project-contracts.json after feature removal.
     */
    private async updateContracts(service: ScaffoldService, feature: string): Promise<void> {
        const contractPath = 'contracts/project-contracts.json';
        if (!service.exists(contractPath)) {
            return;
        }

        const contract = service.readJson<Record<string, unknown>>(contractPath);
        let modified = false;

        // Map feature names to workspace paths
        const workspaceMap: Record<string, string> = {
            cli: 'apps/cli',
            server: 'apps/server',
            webapp: 'apps/web',
        };

        const workspacePath = workspaceMap[feature];
        if (workspacePath) {
            // Remove from optionalWorkspaces
            const optionalWorkspaces = (contract.optionalWorkspaces as Record<string, string>) ?? {};
            if (optionalWorkspaces[workspacePath]) {
                delete optionalWorkspaces[workspacePath];
                contract.optionalWorkspaces = optionalWorkspaces;
                modified = true;
            }

            // Remove dependency rules for the workspace's package names
            const featureDef = SCAFFOLD_FEATURES[feature];
            const packageNames = featureDef?.packages ?? [];
            if (packageNames.length > 0) {
                const dependencyRules = (contract.workspaceDependencyRules as Record<string, string[]>) ?? {};
                for (const pkg of packageNames) {
                    if (pkg in dependencyRules) {
                        delete dependencyRules[pkg];
                        modified = true;
                    }
                }
            }
        }

        if (modified) {
            service.writeJson(contractPath, contract);
        }
    }

    /**
     * Run post-remove shell commands to keep workspace in sync.
     */
    private runPostRemoveScripts(service: ScaffoldService): void {
        service.runShell('bun install');
        service.runShell('bun run generate:instructions');
    }
}
