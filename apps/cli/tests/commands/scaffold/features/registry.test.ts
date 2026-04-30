import { describe, expect, test } from 'bun:test';
import {
    ALL_FEATURES,
    getFeature,
    isOptionalFeature,
    isRequiredFeature,
    OPTIONAL_FEATURES,
    REQUIRED_FEATURES,
    SCAFFOLD_FEATURES,
} from '../../../../src/commands/scaffold/features/registry';

describe('scaffold feature registry', () => {
    describe('REQUIRED_FEATURES', () => {
        test('contains contracts and core', () => {
            expect(REQUIRED_FEATURES).toContain('contracts');
            expect(REQUIRED_FEATURES).toContain('core');
        });

        test('does not contain optional features', () => {
            expect(REQUIRED_FEATURES).not.toContain('cli');
            expect(REQUIRED_FEATURES).not.toContain('server');
            expect(REQUIRED_FEATURES).not.toContain('webapp');
        });
    });

    describe('OPTIONAL_FEATURES', () => {
        test('contains cli, server, webapp', () => {
            expect(OPTIONAL_FEATURES).toContain('cli');
            expect(OPTIONAL_FEATURES).toContain('server');
            expect(OPTIONAL_FEATURES).toContain('webapp');
        });
    });

    describe('ALL_FEATURES', () => {
        test('is union of required and optional', () => {
            expect(ALL_FEATURES.length).toBe(REQUIRED_FEATURES.length + OPTIONAL_FEATURES.length);
            for (const f of REQUIRED_FEATURES) {
                expect(ALL_FEATURES).toContain(f);
            }
            for (const f of OPTIONAL_FEATURES) {
                expect(ALL_FEATURES).toContain(f);
            }
        });
    });

    describe('SCAFFOLD_FEATURES', () => {
        test('has entry for every feature in ALL_FEATURES', () => {
            for (const name of ALL_FEATURES) {
                expect(SCAFFOLD_FEATURES[name]).toBeDefined();
                expect(SCAFFOLD_FEATURES[name].name).toBeString();
                expect(SCAFFOLD_FEATURES[name].description).toBeString();
                expect(SCAFFOLD_FEATURES[name].files).toBeArray();
                expect(SCAFFOLD_FEATURES[name].rewrites).toBeObject();
            }
        });

        test('required features have no files to delete', () => {
            for (const name of REQUIRED_FEATURES) {
                expect(SCAFFOLD_FEATURES[name].files).toEqual([]);
            }
        });

        test('optional features have files to delete', () => {
            for (const name of OPTIONAL_FEATURES) {
                expect(SCAFFOLD_FEATURES[name].files.length).toBeGreaterThan(0);
            }
        });
    });

    describe('getFeature', () => {
        test('returns feature definition for known features', () => {
            expect(getFeature('contracts')).toBeDefined();
            expect(getFeature('core')).toBeDefined();
            expect(getFeature('cli')).toBeDefined();
        });

        test('returns undefined for unknown features', () => {
            expect(getFeature('nonexistent')).toBeUndefined();
        });
    });

    describe('isRequiredFeature', () => {
        test('returns true for required features', () => {
            expect(isRequiredFeature('contracts')).toBe(true);
            expect(isRequiredFeature('core')).toBe(true);
        });

        test('returns false for optional features', () => {
            expect(isRequiredFeature('cli')).toBe(false);
            expect(isRequiredFeature('server')).toBe(false);
        });
    });

    describe('isOptionalFeature', () => {
        test('returns true for optional features', () => {
            expect(isOptionalFeature('cli')).toBe(true);
            expect(isOptionalFeature('server')).toBe(true);
            expect(isOptionalFeature('webapp')).toBe(true);
        });

        test('returns false for required features', () => {
            expect(isOptionalFeature('contracts')).toBe(false);
            expect(isOptionalFeature('core')).toBe(false);
        });
    });
});
