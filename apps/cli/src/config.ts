/**
 * CLI package configuration.
 *
 * Typed constants for @starter/cli. Binary metadata is consumed by Clipanion
 * and may also be used for --version output.
 */
export const CLI_CONFIG = {
    /** Display name shown in --help */
    binaryLabel: 'TypeScript Bun Starter',

    /** Command name / binary name */
    binaryName: 'tbs',

    /** Version string — keep in sync with root package.json */
    binaryVersion: '0.1.0',
} as const;
