import { describe, expect, it } from 'vitest';
import {
    getFeature,
    isOptionalFeature,
    isRequiredFeature,
    OPTIONAL_FEATURES,
    REQUIRED_FEATURES,
    SCAFFOLD_FEATURES,
} from '../../../src/commands/scaffold/features/registry';

describe('Feature Registry', () => {
    describe('REQUIRED_FEATURES', () => {
        it('should contain contracts and core', () => {
            expect(REQUIRED_FEATURES).toContain('contracts');
            expect(REQUIRED_FEATURES).toContain('core');
        });

        it('should not include optional features', () => {
            expect(REQUIRED_FEATURES).not.toContain('cli');
            expect(REQUIRED_FEATURES).not.toContain('server');
            expect(REQUIRED_FEATURES).not.toContain('webapp');
            expect(REQUIRED_FEATURES).not.toContain('skills');
        });
    });

    describe('OPTIONAL_FEATURES', () => {
        it('should contain cli, server, webapp, skills', () => {
            expect(OPTIONAL_FEATURES).toContain('cli');
            expect(OPTIONAL_FEATURES).toContain('server');
            expect(OPTIONAL_FEATURES).toContain('webapp');
            expect(OPTIONAL_FEATURES).toContain('skills');
        });

        it('should not include required features', () => {
            expect(OPTIONAL_FEATURES).not.toContain('contracts');
            expect(OPTIONAL_FEATURES).not.toContain('core');
        });
    });

    describe('SCAFFOLD_FEATURES', () => {
        it('should have all required features', () => {
            for (const feature of REQUIRED_FEATURES) {
                expect(SCAFFOLD_FEATURES[feature]).toBeDefined();
                expect(SCAFFOLD_FEATURES[feature].name).toBeDefined();
                expect(SCAFFOLD_FEATURES[feature].description).toBeDefined();
            }
        });

        it('should have all optional features', () => {
            for (const feature of OPTIONAL_FEATURES) {
                expect(SCAFFOLD_FEATURES[feature]).toBeDefined();
                expect(SCAFFOLD_FEATURES[feature].name).toBeDefined();
                expect(SCAFFOLD_FEATURES[feature].description).toBeDefined();
            }
        });

        it('should have correct workspace paths for apps', () => {
            expect(SCAFFOLD_FEATURES.cli.workspacePath).toBe('apps/cli');
            expect(SCAFFOLD_FEATURES.server.workspacePath).toBe('apps/server');
            expect(SCAFFOLD_FEATURES.webapp.workspacePath).toBe('apps/web');
        });

        it('should have skills files defined', () => {
            const skills = SCAFFOLD_FEATURES.skills;
            expect(skills.files.length).toBeGreaterThan(0);
            expect(skills.files).toContain('packages/core/src/services/skill-service.ts');
            expect(skills.files).toContain('apps/cli/src/commands/skill-list.ts');
        });
    });

    describe('getFeature', () => {
        it('should return feature definition for valid name', () => {
            const feature = getFeature('cli');
            expect(feature).toBeDefined();
            expect(feature?.name).toBe('CLI');
        });

        it('should return undefined for invalid name', () => {
            expect(getFeature('nonexistent')).toBeUndefined();
        });
    });

    describe('isRequiredFeature', () => {
        it('should return true for required features', () => {
            expect(isRequiredFeature('contracts')).toBe(true);
            expect(isRequiredFeature('core')).toBe(true);
        });

        it('should return false for optional features', () => {
            expect(isRequiredFeature('cli')).toBe(false);
            expect(isRequiredFeature('skills')).toBe(false);
        });
    });

    describe('isOptionalFeature', () => {
        it('should return true for optional features', () => {
            expect(isOptionalFeature('cli')).toBe(true);
            expect(isOptionalFeature('server')).toBe(true);
            expect(isOptionalFeature('webapp')).toBe(true);
            expect(isOptionalFeature('skills')).toBe(true);
        });

        it('should return false for required features', () => {
            expect(isOptionalFeature('contracts')).toBe(false);
            expect(isOptionalFeature('core')).toBe(false);
        });
    });
});
