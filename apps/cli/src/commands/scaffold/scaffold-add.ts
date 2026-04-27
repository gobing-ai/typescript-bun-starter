import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { echoError } from '@starter/core';
import { writeOutput, writeSuccess } from '../../ui/output';
import { getFeature, isRequiredFeature, REQUIRED_FEATURES, SCAFFOLD_FEATURES } from './features/registry';
import { ScaffoldService } from './services/scaffold-service';

// ---------------------------------------------------------------------------
// Action (invoked by commander wiring in scaffold/index.ts)
// ---------------------------------------------------------------------------

export interface AddActionOpts {
    dryRun?: boolean;
    json?: boolean;
}

export async function scaffoldAddAction(
    feature: string,
    opts: AddActionOpts,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    const isJson = opts.json ?? false;
    const service = new ScaffoldService();

    if (!feature) {
        process.exitCode = writeOutput(out, err, isJson, null, 'Feature name is required');
        return;
    }

    const featureDef = getFeature(feature);
    if (!featureDef) {
        const optionalFeatures = Object.keys(SCAFFOLD_FEATURES).filter(
            (f) => !REQUIRED_FEATURES.includes(f as (typeof REQUIRED_FEATURES)[number]),
        );
        process.exitCode = writeOutput(
            out,
            err,
            isJson,
            null,
            `Unknown feature: ${feature}. Available: ${optionalFeatures.join(', ')}`,
        );
        return;
    }

    if (isRequiredFeature(feature)) {
        process.exitCode = writeOutput(
            out,
            err,
            isJson,
            null,
            `Cannot add required feature: ${feature} (already included)`,
        );
        return;
    }

    if (isFeatureInstalled(feature, service)) {
        process.exitCode = writeOutput(out, err, isJson, null, `Feature '${feature}' is already installed`);
        return;
    }

    const templateRoot = resolve(service.getRoot(), 'scripts/scaffold/templates');
    const templateDir = resolve(templateRoot, feature);

    if (!existsSync(templateDir)) {
        process.exitCode = writeOutput(
            out,
            err,
            isJson,
            null,
            `Template for '${feature}' not found at ${templateDir}. Run 'bun run generate:scaffold-templates' first.`,
        );
        return;
    }

    const { filesToCopy, dirsToCreate } = collectTemplateFiles(templateDir);

    if (opts.dryRun) {
        writeOutput(out, err, isJson, {
            feature,
            filesToCopy,
            dirsToCreate,
            preview: formatAddDryRunOutput(feature, filesToCopy, dirsToCreate),
        });
        return;
    }

    const createdDirs: string[] = [];
    const copiedFiles: string[] = [];

    try {
        for (const dir of dirsToCreate) {
            const absDir = resolve(service.getRoot(), dir);
            const created = mkdirSync(absDir, { recursive: true });
            if (created !== undefined) {
                createdDirs.push(dir);
            }
        }

        for (const { src, dest } of filesToCopy) {
            const absSrc = resolve(templateDir, src);
            const absDest = resolve(service.getRoot(), dest);
            cpSync(absSrc, absDest, { recursive: true });
            copiedFiles.push(dest);
        }
    } catch (rollbackErr) {
        for (const file of copiedFiles) {
            const absFile = resolve(service.getRoot(), file);
            try {
                rmSync(absFile, { recursive: true, force: true });
            } catch (e) {
                echoError(`Warning: failed to roll back ${absFile}: ${String(e)}`, err);
            }
        }
        for (const dir of createdDirs.reverse()) {
            const absDir = resolve(service.getRoot(), dir);
            try {
                rmSync(absDir, { recursive: true, force: true });
            } catch (e) {
                echoError(`Warning: failed to roll back ${absDir}: ${String(e)}`, err);
            }
        }
        process.exitCode = writeOutput(
            out,
            err,
            isJson,
            null,
            `Failed to add feature '${feature}': ${String(rollbackErr)}`,
        );
        return;
    }

    await updateAddContracts(service, feature, err);

    writeSuccess(out, isJson, `Feature '${feature}' added`);
    writeOutput(out, err, isJson, {
        success: true,
        feature,
        filesAdded: filesToCopy.length,
        dirsCreated: dirsToCreate.length,
    });
}

// ---------------------------------------------------------------------------
// Module-level functions (exported for testing)
// ---------------------------------------------------------------------------

export function isFeatureInstalled(feature: string, service: ScaffoldService): boolean {
    const featureDef = SCAFFOLD_FEATURES[feature];
    if (featureDef?.workspacePath) {
        return service.exists(featureDef.workspacePath);
    }
    return false;
}

export function collectTemplateFiles(templateDir: string): {
    filesToCopy: Array<{ src: string; dest: string }>;
    dirsToCreate: string[];
} {
    const filesToCopy: Array<{ src: string; dest: string }> = [];
    const dirsToCreate = new Set<string>();

    const walk = (dir: string, relDir = ''): void => {
        const entries = readdirSync(dir);
        for (const entry of entries.sort()) {
            const absPath = resolve(dir, entry);
            const stat = statSync(absPath);
            const srcPath = relDir ? `${relDir}/${entry}` : entry;

            if (stat.isDirectory()) {
                dirsToCreate.add(srcPath);
                walk(absPath, srcPath);
            } else if (stat.isFile()) {
                filesToCopy.push({ src: srcPath, dest: srcPath });
            }
        }
    };

    walk(templateDir);
    return { filesToCopy, dirsToCreate: [...dirsToCreate] };
}

export function formatAddDryRunOutput(
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

export async function updateAddContracts(
    service: ScaffoldService,
    feature: string,
    stderr: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    const contractPath = 'contracts/project-contracts.json';
    if (!service.exists(contractPath)) {
        return;
    }

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
        return;
    }

    const absContractPath = service.resolvePath(contractPath);
    const backupPath = `${absContractPath}.bak`;
    copyFileSync(absContractPath, backupPath);

    try {
        optionalWorkspaces[featureConfig.path] = featureConfig.pkg;
        contract.optionalWorkspaces = optionalWorkspaces;
        service.writeJson(contractPath, contract);
    } catch (err) {
        try {
            const content = service.readFile(`${contractPath}.bak`);
            service.writeFile(contractPath, content);
        } catch (restoreErr) {
            echoError(`Warning: failed to restore ${contractPath} from backup: ${String(restoreErr)}`, stderr);
        }
        throw err;
    } finally {
        try {
            rmSync(backupPath, { force: true });
        } catch (cleanupErr) {
            echoError(`Warning: failed to remove backup ${backupPath}: ${String(cleanupErr)}`, stderr);
        }
    }
}
