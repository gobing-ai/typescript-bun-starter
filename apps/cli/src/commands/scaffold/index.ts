import type { Command } from '@commander-js/extra-typings';
import { scaffoldAddAction } from './scaffold-add';
import { scaffoldInitAction } from './scaffold-init';
import { scaffoldListAction } from './scaffold-list';
import { scaffoldRemoveAction } from './scaffold-remove';
import { scaffoldValidateAction } from './scaffold-validate';

export function registerScaffoldCommands(
    program: Command,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): void {
    const scaffold = program.command('scaffold').description('Project scaffolding commands');

    // scaffold init
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
            await scaffoldInitAction(opts, out, err);
        });

    // scaffold add
    scaffold
        .command('add')
        .description('Add optional feature modules')
        .addHelpText(
            'after',
            `
Examples:
  tbs scaffold add webapp
  tbs scaffold add webapp --dry-run
  tbs scaffold add server --json`,
        )
        .argument('<feature>', 'Feature name (webapp, server, cli)')
        .option('--dry-run', 'Preview changes without applying')
        .option('--json', 'Output as JSON (agent mode)')
        .action(async (feature, opts) => {
            await scaffoldAddAction(feature, opts, out, err);
        });

    // scaffold remove
    scaffold
        .command('remove')
        .description('Remove optional feature modules')
        .addHelpText(
            'after',
            `
Examples:
  tbs scaffold remove webapp
  tbs scaffold remove webapp --dry-run
  tbs scaffold remove server --json`,
        )
        .argument('<feature>', 'Feature name (webapp, server, cli)')
        .option('--dry-run', 'Preview changes without applying')
        .option('--json', 'Output as JSON (agent mode)')
        .action(async (feature, opts) => {
            await scaffoldRemoveAction(feature, opts, out, err);
        });

    // scaffold list
    scaffold
        .command('list')
        .description('List available scaffold features and their status')
        .addHelpText(
            'after',
            `
Examples:
  tbs scaffold list
  tbs scaffold list --json`,
        )
        .option('--json', 'Output as JSON (agent mode)')
        .action(async (opts) => {
            await scaffoldListAction(opts, out, err);
        });

    // scaffold validate
    scaffold
        .command('validate')
        .description('Validate project contracts and structure')
        .addHelpText(
            'after',
            `
Examples:
  tbs scaffold validate
  tbs scaffold validate --fix
  tbs scaffold validate --json`,
        )
        .option('--fix', 'Auto-fix fixable issues')
        .option('--dry-run', 'Preview changes without applying')
        .option('--json', 'Output as JSON (agent mode)')
        .action(async (opts) => {
            await scaffoldValidateAction(opts, out, err);
        });
}

// Re-export types and services (unchanged)
export {
    ALL_FEATURES,
    getFeature,
    isOptionalFeature,
    isRequiredFeature,
    OPTIONAL_FEATURES,
    REQUIRED_FEATURES,
    SCAFFOLD_FEATURES,
} from './features/registry';
export { ScaffoldService } from './services/scaffold-service';
export * from './types/scaffold';
