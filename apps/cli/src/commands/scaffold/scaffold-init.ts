import type { Command } from '@commander-js/extra-typings';
import { echoError } from '@starter/core';
import { formatDryRunPreview, writeOutput, writeSuccess } from './scaffold-output';
import { ScaffoldService } from './services/scaffold-service';
import type { ContractFile, ProjectIdentity, ScaffoldInitOptions } from './types/scaffold';

/** Minimum length for a replacement token (avoids false matches on short slugs). */
const MIN_REPLACEMENT_LENGTH = 3;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerInitCommand(
    scaffold: Command,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): void {
    scaffold
        .command('init')
        .description('Initialize project identity (name, scope, branding)')
        .addHelpText(
            'after',
            `
Examples:
  tbs scaffold init --name my-project --scope @myorg
  tbs scaffold init --name my-project --scope @myorg --dry-run
  tbs scaffold init --name my-project --scope @myorg --json`,
        )
        .option('--name <slug>', 'Project slug (kebab-case, required)')
        .option('--title <title>', 'Display name (Title Case)')
        .option('--brand <brand>', 'Short brand name')
        .option('--scope <scope>', 'NPM scope (e.g., @myorg, required)')
        .option('--repo-url <url>', 'Repository URL')
        .option('--bin <name>', 'CLI binary name (default: tbs)')
        .option('--skip-check', 'Skip post-init verification')
        .option('--dry-run', 'Preview changes without applying')
        .option('--json', 'Output as JSON (agent mode)')
        .action(async (opts) => {
            const isJson = opts.json ?? false;
            const service = new ScaffoldService();

            const options = collectInitOptions(opts, service, isJson);
            const validation = validateInitOptions(options);
            if (!validation.ok) {
                process.exitCode = writeOutput(out, err, isJson, null, validation.error);
                return;
            }

            const identity = computeIdentity(options, service);
            const pendingWrites = stageInitChanges(service, identity, err);
            const filesToChange = [...pendingWrites.keys()].sort();

            if (opts.dryRun) {
                process.exitCode = writeOutput(out, err, isJson, {
                    files: filesToChange,
                    preview: formatDryRunPreview(filesToChange, 'write'),
                });
                return;
            }

            for (const [relPath, content] of pendingWrites) {
                service.writeFile(relPath, content);
            }

            await runPostInitScripts(service, options, err);

            writeSuccess(out, isJson, `Project initialized: ${identity.displayName}`);
            writeOutput(out, err, isJson, { success: true, files: filesToChange });
        });
}

// ---------------------------------------------------------------------------
// Module-level functions (exported for testing)
// ---------------------------------------------------------------------------

export function collectInitOptions(
    opts: {
        name?: string;
        title?: string;
        brand?: string;
        scope?: string;
        repoUrl?: string;
        bin?: string;
        dryRun?: boolean;
        skipCheck?: boolean;
        json?: boolean;
    },
    service: ScaffoldService,
    isJson: boolean,
): ScaffoldInitOptions {
    if (isJson) {
        return {
            ...(opts.name ? { name: opts.name } : {}),
            ...(opts.title ? { title: opts.title } : {}),
            ...(opts.brand ? { brand: opts.brand } : {}),
            ...(opts.scope ? { scope: opts.scope } : {}),
            ...(opts.repoUrl ? { repoUrl: opts.repoUrl } : {}),
            ...(opts.bin ? { bin: opts.bin } : {}),
            dryRun: opts.dryRun ?? false,
            skipCheck: opts.skipCheck ?? false,
        };
    }

    const slug = opts.name ?? promptTextForInit('Project slug (kebab-case, e.g., my-project)');
    const displayTitle = opts.title ?? service.toTitleCase(slug);
    const brandName = opts.brand ?? displayTitle;
    const npmScope = opts.scope ?? promptTextForInit('NPM scope (e.g., @myorg)', '@myorg');

    return {
        name: slug,
        title: displayTitle,
        brand: brandName,
        scope: npmScope,
        ...(opts.repoUrl ? { repoUrl: opts.repoUrl } : {}),
        ...(opts.bin ? { bin: opts.bin } : {}),
        dryRun: opts.dryRun ?? false,
        skipCheck: opts.skipCheck ?? false,
    };
}

export function promptTextForInit(label: string, defaultValue?: string): string {
    if (defaultValue) {
        return defaultValue;
    }
    throw new Error(`${label} is required. Use --${label.replace(/ /g, '-')} flag or run in --json mode.`);
}

export function validateInitOptions(options: ScaffoldInitOptions): { ok: true } | { ok: false; error: string } {
    if (!options.name) {
        return { ok: false, error: '--name is required' };
    }
    if (!options.scope) {
        return { ok: false, error: '--scope is required' };
    }
    if (!options.scope.startsWith('@')) {
        return { ok: false, error: '--scope must start with @' };
    }
    if (options.name.includes('@')) {
        return { ok: false, error: '--name should be a slug, not an NPM package name' };
    }
    return { ok: true };
}

export function computeIdentity(options: ScaffoldInitOptions, service: ScaffoldService): ProjectIdentity {
    const slug = service.slugify(options.name ?? '');
    const title = options.title ?? service.toTitleCase(slug);
    const brand = options.brand ?? title;
    const scope = service.normalizeScope(options.scope ?? '');
    const bin = options.bin ?? 'tbs';

    return {
        displayName: title,
        brandName: brand,
        projectSlug: slug,
        rootPackageName: `${scope}/${slug}-starter`,
        repositoryUrl: options.repoUrl ?? `https://github.com/${scope.slice(1)}/${slug}`,
        binaryName: bin,
        binaryLabel: brand,
        apiTitle: `${brand} API`,
        webDescription: `${brand} WebApp`,
    };
}

export function stageInitChanges(
    service: ScaffoldService,
    identity: ProjectIdentity,
    stderr: NodeJS.WritableStream = process.stderr,
): Map<string, string> {
    const pendingWrites = new Map<string, string>();

    const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
    const currentIdentity = contract.projectIdentity;

    const replacements: Array<[string, string]> = [
        [currentIdentity.displayName, identity.displayName],
        [currentIdentity.brandName, identity.brandName],
        [currentIdentity.projectSlug, identity.projectSlug],
        [currentIdentity.rootPackageName, identity.rootPackageName],
        [currentIdentity.repositoryUrl, identity.repositoryUrl],
        [currentIdentity.binaryName, identity.binaryName],
        [currentIdentity.binaryLabel, identity.binaryLabel],
        [currentIdentity.apiTitle, identity.apiTitle],
        [currentIdentity.webDescription, identity.webDescription],
    ];

    contract.projectIdentity = identity;
    pendingWrites.set('contracts/project-contracts.json', `${JSON.stringify(contract, null, 4)}\n`);

    const packageJson = service.readJson<Record<string, unknown>>('package.json');
    packageJson.name = identity.rootPackageName;
    pendingWrites.set('package.json', `${JSON.stringify(packageJson, null, 4)}\n`);

    const textFiles = service.collectTextFilePaths();
    for (const relPath of textFiles) {
        const content = service.readFile(relPath);
        const updated = replaceInContent(content, replacements, stderr);
        if (updated !== content) {
            pendingWrites.set(relPath, updated);
        }
    }

    return pendingWrites;
}

export function replaceInContent(
    content: string,
    replacements: Array<[string, string]>,
    stderr: NodeJS.WritableStream = process.stderr,
): string {
    let updated = content;
    for (const [from, to] of replacements) {
        if (!from || from === to) {
            continue;
        }
        if (from.length < MIN_REPLACEMENT_LENGTH) {
            echoError(
                `Warning: skipping replacement of "${from}" → "${to}" — token shorter than ` +
                    `${MIN_REPLACEMENT_LENGTH} chars would match too aggressively.`,
                stderr,
            );
            continue;
        }
        updated = updated.replaceAll(from, to);
    }
    return updated;
}

export async function runPostInitScripts(
    service: ScaffoldService,
    options: ScaffoldInitOptions,
    stderr: NodeJS.WritableStream = process.stderr,
): Promise<void> {
    if (options.skipCheck) {
        return;
    }

    const { spawnSync } = await import('node:child_process');

    const steps: Array<{ label: string; cmd: string; args: string[] }> = [
        { label: 'bun install', cmd: 'bun', args: ['install'] },
        { label: 'bun run generate:instructions', cmd: 'bun', args: ['run', 'generate:instructions'] },
        { label: 'biome format --write .', cmd: './node_modules/.bin/biome', args: ['format', '--write', '.'] },
        { label: 'bun run check', cmd: 'bun', args: ['run', 'check'] },
    ];

    for (const step of steps) {
        const result = spawnSync(step.cmd, step.args, {
            cwd: service.getRoot(),
            stdio: 'inherit',
        });

        if (result.error) {
            echoError(`Warning: post-init step "${step.label}" failed to start: ${result.error.message}`, stderr);
            continue;
        }
        const status = result.status ?? 1;
        if (status !== 0) {
            echoError(
                `Warning: post-init step "${step.label}" exited with code ${status}. ` +
                    'Run it manually to finish project initialization.',
                stderr,
            );
        }
    }
}
