import { Command } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import { OPTIONAL_FEATURES, REQUIRED_FEATURES, SCAFFOLD_FEATURES } from './features/registry';
import { ScaffoldService } from './services/scaffold-service';
import type { FeatureStatus } from './types/scaffold';

export class ScaffoldListCommand extends BaseScaffoldCommand {
    constructor() {
        super();
    }

    static paths = [['scaffold', 'list']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'List available scaffold features and their status',
        details: `
            Show all available scaffold features (required and optional) with their
            installation status.

            Required features are always installed and cannot be removed.
            Optional features can be added or removed as needed.

            Use 'tbs scaffold add <feature>' to install an optional feature.
            Use 'tbs scaffold remove <feature>' to uninstall an optional feature.
        `,
        examples: [
            ['List all features', 'tbs scaffold list'],
            ['JSON output', 'tbs scaffold list --json'],
        ],
    });

    async execute(): Promise<number> {
        const service = new ScaffoldService();

        // Build feature status lists
        const required: FeatureStatus[] = REQUIRED_FEATURES.map((name) => ({
            name,
            description: SCAFFOLD_FEATURES[name]?.description ?? name,
            installed: true, // Required features are always installed
            workspacePath: SCAFFOLD_FEATURES[name]?.workspacePath,
        }));

        const optional: FeatureStatus[] = OPTIONAL_FEATURES.map((name) => ({
            name,
            description: SCAFFOLD_FEATURES[name]?.description ?? name,
            installed: this.isInstalled(name, service),
            workspacePath: SCAFFOLD_FEATURES[name]?.workspacePath,
        }));

        if (this.json) {
            return this.writeOutput({ required, optional });
        }

        // Text output
        let output = '\n';
        output += this.formatHeader('Available Scaffold Features');
        output += '\n';

        // Required features
        output += this.formatSection('Required (always installed)', required, true);
        output += '\n';

        // Optional features
        output += this.formatSection('Optional (add/remove as needed)', optional, false);
        output += '\n';

        // Usage hints
        output += this.formatSection(
            'Usage',
            [
                { name: 'tbs scaffold add <feature>', description: 'Install an optional feature', installed: false },
                {
                    name: 'tbs scaffold remove <feature>',
                    description: 'Uninstall an optional feature',
                    installed: false,
                },
            ],
            false,
        );

        this.context.stdout.write(`${output}\n`);
        return 0;
    }

    /**
     * Check if a feature is installed.
     */
    private isInstalled(feature: string, service: ScaffoldService): boolean {
        if (feature === 'skills') {
            return service.exists('packages/core/src/services/skill-service.ts');
        }

        const featureDef = SCAFFOLD_FEATURES[feature];
        if (featureDef?.workspacePath) {
            return service.exists(featureDef.workspacePath);
        }

        return false;
    }

    /**
     * Format a header.
     */
    private formatHeader(text: string): string {
        const line = '═'.repeat(text.length + 4);
        return `${line}\n  ${text}\n${line}`;
    }

    /**
     * Format a section with feature list.
     */
    private formatSection(title: string, features: FeatureStatus[], showAlwaysInstalled: boolean): string {
        let output = `${title}:\n`;

        for (const feature of features) {
            const status = feature.installed ? '✓' : '○';
            const statusText = showAlwaysInstalled ? '✓' : `[${status}]`;
            const name = feature.name.padEnd(12);
            const workspace = feature.workspacePath ? ` (${feature.workspacePath})` : '';
            output += `  ${statusText} ${name} ${feature.description}${workspace}\n`;
        }

        return output;
    }
}
