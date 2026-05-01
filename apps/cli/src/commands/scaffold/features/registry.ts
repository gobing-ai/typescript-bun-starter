import type { FeatureDefinition } from '../types/scaffold';

/**
 * Required features that cannot be removed.
 */
export const REQUIRED_FEATURES = ['contracts', 'core'] as const;

/**
 * Optional features that can be added/removed.
 */
export const OPTIONAL_FEATURES = ['cli', 'server', 'webapp'] as const;

/**
 * All known features (required + optional).
 */
export const ALL_FEATURES = [...REQUIRED_FEATURES, ...OPTIONAL_FEATURES] as const;

/**
 * Registry of all scaffold features.
 * Defines what files to add/remove for each feature.
 */
export const SCAFFOLD_FEATURES: Record<string, FeatureDefinition> = {
    // ---------------------------------------------------------------------------
    // Required Features (always installed)
    // ---------------------------------------------------------------------------
    contracts: {
        name: 'Contracts',
        description: 'Shared contracts and transport-safe DTOs',
        files: [],
        rewrites: {},
        packages: ['@starter/contracts'],
        workspacePath: 'packages/contracts',
    },
    core: {
        name: 'Core',
        description: 'Core domain, data layer, and shared utilities',
        files: [],
        rewrites: {},
        packages: ['@starter/core'],
        workspacePath: 'packages/core',
    },

    // ---------------------------------------------------------------------------
    // Optional Features
    // ---------------------------------------------------------------------------
    cli: {
        name: 'CLI',
        description: 'Commander.js-based CLI tool for project commands',
        files: [
            'apps/cli/src/index.ts',
            'apps/cli/src/config.ts',
            'apps/cli/src/commands/.gitkeep',
            'apps/cli/tests/.gitkeep',
        ],
        rewrites: {},
        packages: ['@starter/cli'],
        workspacePath: 'apps/cli',
    },
    server: {
        name: 'Server',
        description: 'Hono-based REST API server',
        files: [
            'apps/server/src/index.ts',
            'apps/server/src/config.ts',
            'apps/server/src/scheduled.ts',
            'apps/server/src/routes/.gitkeep',
            'apps/server/src/middleware/.gitkeep',
            'apps/server/tests/.gitkeep',
            'apps/server/wrangler.toml',
        ],
        rewrites: {},
        packages: ['@starter/server'],
        workspacePath: 'apps/server',
    },
    webapp: {
        name: 'WebApp',
        description: 'Astro-based web application',
        files: [
            'apps/web/src/pages/index.astro',
            'apps/web/src/layouts/.gitkeep',
            'apps/web/src/components/.gitkeep',
            'apps/web/public/_headers',
            'apps/web/public/_routes.json',
            'apps/web/wrangler.toml',
            'apps/web/package.json',
        ],
        rewrites: {},
        packages: ['@starter/web'],
        workspacePath: 'apps/web',
    },
};

/**
 * Get feature definition by name.
 */
export function getFeature(name: string): FeatureDefinition | undefined {
    return SCAFFOLD_FEATURES[name];
}

/**
 * Check if a feature is required (cannot be removed).
 */
export function isRequiredFeature(name: string): boolean {
    return REQUIRED_FEATURES.includes(name as (typeof REQUIRED_FEATURES)[number]);
}

/**
 * Check if a feature is optional (can be added/removed).
 */
export function isOptionalFeature(name: string): boolean {
    return OPTIONAL_FEATURES.includes(name as (typeof OPTIONAL_FEATURES)[number]);
}
