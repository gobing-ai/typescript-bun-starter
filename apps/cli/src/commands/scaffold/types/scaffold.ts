/**
 * Project identity configuration.
 */
export interface ProjectIdentity {
    displayName: string;
    brandName: string;
    projectSlug: string;
    rootPackageName: string;
    repositoryUrl: string;
    binaryName: string;
    binaryLabel: string;
    apiTitle: string;
    webDescription: string;
}

/**
 * Options for scaffold init command.
 */
export interface ScaffoldInitOptions {
    name?: string;
    title?: string;
    brand?: string;
    scope?: string;
    rootPackageName?: string;
    repoUrl?: string;
    bin?: string;
    dryRun?: boolean;
    skipCheck?: boolean;
}

/**
 * Definition of an optional feature module.
 */
export interface FeatureDefinition {
    name: string;
    description: string;
    /** Files to delete when removing this feature */
    files: string[];
    /** Content to rewrite when removing (strips feature references) */
    rewrites: Record<string, string>;
    /** Package names this feature provides */
    packages?: string[];
    /** Workspace path (e.g., 'apps/cli', 'apps/server') */
    workspacePath?: string;
}

/**
 * Result of a scaffold operation.
 */
export type ScaffoldResult = { ok: true; filesChanged: string[]; message?: string } | { ok: false; error: string };

/**
 * Result of a validation check.
 */
export interface ValidationIssue {
    severity: 'error' | 'warning';
    category: 'workspace' | 'script' | 'naming' | 'instructions';
    message: string;
    path?: string;
    fixable: boolean;
}

export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}

/**
 * Feature installation status.
 */
export interface FeatureStatus {
    name: string;
    description: string;
    installed: boolean;
    workspacePath?: string;
}
