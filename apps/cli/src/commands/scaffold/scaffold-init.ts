import { Command, Option } from 'clipanion';
import { BaseScaffoldCommand } from './base-scaffold-command';
import { ScaffoldService } from './services/scaffold-service';
import type { ProjectIdentity, ScaffoldInitOptions } from './types/scaffold';

/**
 * Contract file structure.
 */
interface ContractFile {
    version: number;
    projectIdentity: ProjectIdentity;
    requiredWorkspaces: Record<string, string>;
    optionalWorkspaces: Record<string, string>;
    workspaceDependencyRules: Record<string, string[]>;
}

export class ScaffoldInitCommand extends BaseScaffoldCommand {
    static paths = [['scaffold', 'init']];

    static usage = Command.Usage({
        category: 'Scaffold',
        description: 'Initialize project identity (name, scope, branding)',
        details: `
            This command customizes the starter for your project by updating:
            - Project identity (name, slug, branding)
            - NPM scope (@scope/package-name)
            - Repository URL
            - Binary name for the CLI

            All text files in the project are updated with the new identity.
        `,
        examples: [
            ['Initialize with required args', 'tbs scaffold init --name my-project --scope @myorg'],
            ['Preview changes', 'tbs scaffold init --name my-project --scope @myorg --dry-run'],
            ['JSON mode', 'tbs scaffold init --name my-project --scope @myorg --json'],
        ],
    });

    name = Option.String('--name', {
        description: 'Project slug (kebab-case, required)',
        required: false,
    });

    title = Option.String('--title', {
        description: 'Display name (Title Case, default: derived from --name)',
        required: false,
    });

    brand = Option.String('--brand', {
        description: 'Short brand name (default: derived from --title)',
        required: false,
    });

    scope = Option.String('--scope', {
        description: 'NPM scope (e.g., @myorg, required)',
        required: false,
    });

    repoUrl = Option.String('--repo-url', {
        description: 'Repository URL',
        required: false,
    });

    bin = Option.String('--bin', {
        description: 'CLI binary name (default: tbs)',
        required: false,
    });

    skipCheck = Option.Boolean('--skip-check', false, {
        description: 'Skip post-init verification',
    });

    async execute(): Promise<number> {
        const service = new ScaffoldService();

        // 1. Collect options (prompt for missing in non-JSON mode)
        const options = await this.collectOptions();

        // 2. Validate options
        const validation = this.validateOptions(options);
        if (!validation.ok) {
            return this.writeOutput(null, validation.error);
        }

        // 3. Compute new identity
        const identity = this.computeIdentity(options);

        // 4. Stage changes
        const pendingWrites = this.stageChanges(service, identity);
        const filesToChange = [...pendingWrites.keys()].sort();

        // 5. Dry-run mode
        if (this.dryRun) {
            return this.writeOutput({
                files: filesToChange,
                preview: this.formatDryRunPreview(filesToChange, 'write'),
            });
        }

        // 6. Apply changes
        for (const [relPath, content] of pendingWrites) {
            service.writeFile(relPath, content);
        }

        // 7. Run post-init scripts
        await this.runPostInitScripts(service, options);

        this.writeSuccess(`Project initialized: ${identity.displayName}`);
        return this.writeOutput({ success: true, files: filesToChange });
    }

    /** @internal */
    public async collectOptions(): Promise<ScaffoldInitOptions> {
        if (this.json) {
            // JSON mode: all required
            return {
                name: this.name,
                title: this.title,
                brand: this.brand,
                scope: this.scope,
                repoUrl: this.repoUrl,
                bin: this.bin,
                dryRun: this.dryRun,
                skipCheck: this.skipCheck,
            };
        }

        // Interactive mode: prompt for missing
        const slug = this.name ?? this.promptText('Project slug (kebab-case, e.g., my-project)');
        const displayTitle = this.title ?? service().toTitleCase(slug);
        const brandName = this.brand ?? displayTitle;
        const npmScope = this.scope ?? this.promptText('NPM scope (e.g., @myorg)', '@myorg');

        return {
            name: slug,
            title: displayTitle,
            brand: brandName,
            scope: npmScope,
            repoUrl: this.repoUrl,
            bin: this.bin,
            dryRun: this.dryRun,
            skipCheck: this.skipCheck,
        };
    }

    /** @internal */
    public promptText(label: string, defaultValue?: string): string {
        // For simplicity, require flags in interactive mode too
        // In a full implementation, you'd use an interactive prompt library
        if (defaultValue) {
            return defaultValue;
        }
        throw new Error(`${label} is required. Use --${label.replace(/ /g, '-')} flag or run in --json mode.`);
    }

    /** @internal */
    public validateOptions(options: ScaffoldInitOptions): { ok: true } | { ok: false; error: string } {
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

    /** @internal */
    public computeIdentity(options: ScaffoldInitOptions): ProjectIdentity {
        const service = new ScaffoldService();
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

    /** @internal */
    public stageChanges(service: ScaffoldService, identity: ProjectIdentity): Map<string, string> {
        const pendingWrites = new Map<string, string>();

        // Read current contract
        const contract = service.readJson<ContractFile>('contracts/project-contracts.json');
        const currentIdentity = contract.projectIdentity;

        // Build replacement pairs
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

        // Update contract JSON
        contract.projectIdentity = identity;
        pendingWrites.set('contracts/project-contracts.json', `${JSON.stringify(contract, null, 4)}\n`);

        // Update root package.json
        const packageJson = service.readJson<Record<string, unknown>>('package.json');
        packageJson.name = identity.rootPackageName;
        pendingWrites.set('package.json', `${JSON.stringify(packageJson, null, 4)}\n`);

        // Update all text files
        const textFiles = service.collectTextFilePaths();
        for (const relPath of textFiles) {
            const content = service.readFile(relPath);
            const updated = this.replaceInContent(content, replacements);
            if (updated !== content) {
                pendingWrites.set(relPath, updated);
            }
        }

        return pendingWrites;
    }

    /** @internal */
    public replaceInContent(content: string, replacements: Array<[string, string]>): string {
        let updated = content;
        for (const [from, to] of replacements) {
            if (from && from !== to) {
                updated = updated.split(from).join(to);
            }
        }
        return updated;
    }

    /** @internal */
    public async runPostInitScripts(service: ScaffoldService, options: ScaffoldInitOptions): Promise<void> {
        if (options.skipCheck) {
            return;
        }

        // Run bun install
        const { spawnSync } = await import('node:child_process');
        spawnSync('bun', ['install'], {
            cwd: service.getRoot(),
            stdio: 'inherit',
        });

        // Run generate:instructions
        spawnSync('bun', ['run', 'generate:instructions'], {
            cwd: service.getRoot(),
            stdio: 'inherit',
        });

        // Run biome format
        spawnSync('./node_modules/.bin/biome', ['format', '--write', '.'], {
            cwd: service.getRoot(),
            stdio: 'inherit',
        });
    }
}

// Helper to create service instance lazily
function service(): ScaffoldService {
    return new ScaffoldService();
}
