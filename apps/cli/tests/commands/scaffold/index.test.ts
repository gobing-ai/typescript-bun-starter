import { describe, expect, test } from 'bun:test';
import {
    ALL_FEATURES,
    getFeature,
    isOptionalFeature,
    isRequiredFeature,
    OPTIONAL_FEATURES,
    REQUIRED_FEATURES,
    registerScaffoldCommands,
    SCAFFOLD_FEATURES,
    ScaffoldService,
} from '../../../src/commands/scaffold/index';

describe('scaffold index (barrel)', () => {
    test('exports registerScaffoldCommands', () => {
        expect(typeof registerScaffoldCommands).toBe('function');
    });

    test('exports ScaffoldService', () => {
        expect(typeof ScaffoldService).toBe('function');
    });

    test('re-exports registry constants', () => {
        expect(REQUIRED_FEATURES).toBeDefined();
        expect(OPTIONAL_FEATURES).toBeDefined();
        expect(ALL_FEATURES).toBeDefined();
        expect(SCAFFOLD_FEATURES).toBeDefined();
    });

    test('re-exports registry functions', () => {
        expect(typeof getFeature).toBe('function');
        expect(typeof isRequiredFeature).toBe('function');
        expect(typeof isOptionalFeature).toBe('function');
    });

    test('registerScaffoldCommands registers commands on a program', () => {
        // Create a minimal mock commander program
        const commands: string[] = [];
        const mockCommand = () => {
            const builder = {
                command: (name: string) => {
                    commands.push(name);
                    return builder;
                },
                description: () => builder,
                addHelpText: () => builder,
                option: () => builder,
                argument: () => builder,
                action: () => builder,
            };
            return builder;
        };
        const mockProgram = {
            command: (name: string) => {
                commands.push(name);
                return mockCommand();
            },
        };

        registerScaffoldCommands(mockProgram as never);
        expect(commands).toContain('scaffold');
    });
});
