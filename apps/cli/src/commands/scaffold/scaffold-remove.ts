import { echoError } from '@starter/core';
import { writeOutput, writeSuccess } from '../../ui/output';
import { getFeature, isRequiredFeature, REQUIRED_FEATURES, SCAFFOLD_FEATURES } from './features/registry';
import { isFeatureInstalled } from './scaffold-add';
import { ScaffoldService } from './services/scaffold-service';
import type { ContractFile, FeatureDefinition } from './types/scaffold';

const STARTER_ROOT_PACKAGE_NAME = '@gobing-ai/typescript-bun-starter';

// ---------------------------------------------------------------------------
// Action (invoked by commander wiring in scaffold/index.ts)
// ---------------------------------------------------------------------------

export interface RemoveActionOpts {
    dryRun?: boolean;
    json?: boolean;
}

export async function scaffoldRemoveAction(
    feature: string,
    opts: RemoveActionOpts,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    const isJson = opts.json ?? false;
    const service = new ScaffoldService();

    const featureDef = getFeature(feature);
    if (!featureDef) {
        const optionalFeatures = Object.keys(SCAFFOLD_FEATURES).filter(
            (f) => !REQUIRED_FEATURES.includes(f as (typeof REQUIRED_FEATURES)[number]),
        );
        const available = [...REQUIRED_FEATURES, ...optionalFeatures].join(', ');
        process.exitCode = writeOutput(out, err, isJson, null, `Unknown feature: ${feature}. Available: ${available}`);
        return;
    }

    if (isRequiredFeature(feature)) {
        process.exitCode = writeOutput(out, err, isJson, null, `Cannot remove required feature: ${feature}`);
        return;
    }

    if (shouldBlockStarterWebappRemoval(service, feature)) {
        process.exitCode = writeOutput(
            out,
            err,
            isJson,
            null,
            "Refusing to remove 'webapp' from the starter repository. Run this in a generated project instead.",
        );
        return;
    }

    if (!isFeatureInstalled(feature, service)) {
        process.exitCode = writeOutput(out, err, isJson, null, `Feature '${feature}' is not installed`);
        return;
    }

    const { filesToDelete, filesToRewrite } = stageRemoveChanges(service, featureDef);

    if (opts.dryRun) {
        writeOutput(out, err, isJson, {
            feature,
            filesToDelete,
            filesToRewrite,
            preview: formatRemoveDryRunOutput(feature, filesToDelete, filesToRewrite),
        });
        return;
    }

    for (const relPath of filesToDelete) {
        service.deleteFile(relPath);
    }

    for (const [relPath, content] of filesToRewrite) {
        service.writeFile(relPath, content);
    }

    await updateRemoveContracts(service, feature);
    runPostRemoveScripts(service, err);

    writeSuccess(out, isJson, `Feature '${feature}' removed`);
    writeOutput(out, err, isJson, {
        success: true,
        feature,
        filesDeleted: filesToDelete.length,
        filesRewritten: filesToRewrite.length,
    });
}

// ---------------------------------------------------------------------------
// Module-level functions (exported for testing)
// ---------------------------------------------------------------------------

export function shouldBlockStarterWebappRemoval(service: ScaffoldService, feature: string): boolean {
    if (feature !== 'webapp' || !service.exists('package.json')) {
        return false;
    }

    const packageJson = service.readJson<{ name?: string }>('package.json');
    if (packageJson.name === STARTER_ROOT_PACKAGE_NAME) {
        return true;
    }

    if (!service.exists('contracts/project-contracts.json')) {
        return false;
    }

    const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
    return contract.projectIdentity.rootPackageName === STARTER_ROOT_PACKAGE_NAME;
}

export function stageRemoveChanges(
    service: ScaffoldService,
    featureDef: FeatureDefinition,
): {
    filesToDelete: string[];
    filesToRewrite: Array<[string, string]>;
} {
    const filesToDelete: string[] = [];
    const filesToRewrite: Array<[string, string]> = [];

    if (featureDef.workspacePath && service.exists(featureDef.workspacePath)) {
        filesToDelete.push(featureDef.workspacePath);
        return { filesToDelete, filesToRewrite };
    }

    for (const file of featureDef.files) {
        if (service.exists(file)) {
            filesToDelete.push(file);
        }
    }

    return { filesToDelete, filesToRewrite };
}

export function formatRemoveDryRunOutput(
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

export async function updateRemoveContracts(service: ScaffoldService, feature: string): Promise<void> {
    const contractPath = 'contracts/project-contracts.json';
    if (!service.exists(contractPath)) {
        return;
    }

    const contract = service.readJson<Record<string, unknown>>(contractPath);
    let modified = false;

    const workspaceMap: Record<string, string> = {
        cli: 'apps/cli',
        server: 'apps/server',
        webapp: 'apps/web',
    };

    const workspacePath = workspaceMap[feature];
    if (workspacePath) {
        const optionalWorkspaces = (contract.optionalWorkspaces as Record<string, string>) ?? {};
        if (optionalWorkspaces[workspacePath]) {
            delete optionalWorkspaces[workspacePath];
            contract.optionalWorkspaces = optionalWorkspaces;
            modified = true;
        }

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

export function runPostRemoveScripts(service: ScaffoldService, stderr: NodeJS.WritableStream = process.stderr): void {
    const steps: Array<{ label: string; cmd: string; args: string[] }> = [
        { label: 'bun install', cmd: 'bun', args: ['install'] },
        { label: 'bun run generate:instructions', cmd: 'bun', args: ['run', 'generate:instructions'] },
    ];

    for (const step of steps) {
        const code = service.runShell(step.cmd, step.args);
        if (code !== 0) {
            echoError(
                `Warning: post-remove step "${step.label}" exited with code ${code}. ` +
                    'Run it manually to keep the workspace in sync.',
                stderr,
            );
        }
    }
}
