import { echo } from '@starter/core';
import { writeOutput } from '../../ui/output';
import { OPTIONAL_FEATURES, REQUIRED_FEATURES, SCAFFOLD_FEATURES } from './features/registry';
import { isFeatureInstalled } from './scaffold-add';
import { ScaffoldService } from './services/scaffold-service';
import type { FeatureStatus } from './types/scaffold';

// ---------------------------------------------------------------------------
// Action (invoked by commander wiring in scaffold/index.ts)
// ---------------------------------------------------------------------------

export interface ListActionOpts {
    json?: boolean;
}

export async function scaffoldListAction(
    opts: ListActionOpts,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    const isJson = opts.json ?? false;
    const service = new ScaffoldService();

    const required: FeatureStatus[] = REQUIRED_FEATURES.map((name) => ({
        name,
        description: SCAFFOLD_FEATURES[name]?.description ?? name,
        installed: true,
        ...(SCAFFOLD_FEATURES[name]?.workspacePath ? { workspacePath: SCAFFOLD_FEATURES[name].workspacePath } : {}),
    }));

    const optional: FeatureStatus[] = OPTIONAL_FEATURES.map((name) => ({
        name,
        description: SCAFFOLD_FEATURES[name]?.description ?? name,
        installed: isFeatureInstalled(name, service),
        ...(SCAFFOLD_FEATURES[name]?.workspacePath ? { workspacePath: SCAFFOLD_FEATURES[name].workspacePath } : {}),
    }));

    if (isJson) {
        writeOutput(out, err, isJson, { required, optional });
        return;
    }

    let output = '\n';
    output += formatListHeader('Available Scaffold Features');
    output += '\n';
    output += formatListSection('Required (always installed)', required, true);
    output += '\n';
    output += formatListSection('Optional (add/remove as needed)', optional, false);
    output += '\n';
    output += formatListSection(
        'Usage',
        [
            { name: 'tbs scaffold add <feature>', description: 'Install an optional feature', installed: false },
            { name: 'tbs scaffold remove <feature>', description: 'Uninstall an optional feature', installed: false },
        ],
        false,
    );

    echo(output, out);
}

// ---------------------------------------------------------------------------
// Module-level functions (exported for testing)
// ---------------------------------------------------------------------------

export function formatListHeader(text: string): string {
    const line = '═'.repeat(text.length + 4);
    return `${line}\n  ${text}\n${line}`;
}

export function formatListSection(title: string, features: FeatureStatus[], showAlwaysInstalled: boolean): string {
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
