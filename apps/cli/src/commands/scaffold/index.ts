import type { Command } from '@commander-js/extra-typings';
import { registerAddCommand } from './scaffold-add';
import { registerInitCommand } from './scaffold-init';
import { registerListCommand } from './scaffold-list';
import { registerRemoveCommand } from './scaffold-remove';
import { registerValidateCommand } from './scaffold-validate';

export function registerScaffoldCommands(
    program: Command,
    out: NodeJS.WritableStream = process.stdout,
    err: NodeJS.WritableStream = process.stderr,
): void {
    const scaffold = program.command('scaffold').description('Project scaffolding commands');

    registerInitCommand(scaffold, out, err);
    registerAddCommand(scaffold, out, err);
    registerRemoveCommand(scaffold, out, err);
    registerListCommand(scaffold, out, err);
    registerValidateCommand(scaffold, out, err);
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
