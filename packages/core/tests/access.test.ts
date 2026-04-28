import { describe, expect, it } from 'bun:test';
import { getRoles, hasRole } from '../src/access';

describe('hasRole', () => {
    it('returns false for null profile', () => {
        expect(hasRole(null, 'admin')).toBe(false);
    });

    it('returns false for undefined profile', () => {
        expect(hasRole(undefined, 'admin')).toBe(false);
    });

    it('returns false for empty role string', () => {
        expect(hasRole({ roles: ['admin'] }, '')).toBe(false);
    });

    it('detects role in Zitadel format', () => {
        const profile = {
            'urn:zitadel:iam:org:project:roles': { admin: 'project-1', viewer: 'project-1' },
        };
        expect(hasRole(profile, 'admin')).toBe(true);
        expect(hasRole(profile, 'viewer')).toBe(true);
        expect(hasRole(profile, 'editor')).toBe(false);
    });

    it('detects role in generic roles array', () => {
        const profile = { roles: ['admin', 'viewer'] };
        expect(hasRole(profile, 'admin')).toBe(true);
        expect(hasRole(profile, 'editor')).toBe(false);
    });

    it('detects role in generic roles object', () => {
        const profile = { roles: { admin: true, viewer: false } };
        expect(hasRole(profile, 'admin')).toBe(true);
        expect(hasRole(profile, 'viewer')).toBe(true);
        expect(hasRole(profile, 'editor')).toBe(false);
    });

    it('returns false when Zitadel roles is an array', () => {
        const profile = {
            'urn:zitadel:iam:org:project:roles': ['admin'],
        };
        expect(hasRole(profile, 'admin')).toBe(false);
    });

    it('returns false when no role claims exist', () => {
        expect(hasRole({ sub: 'user-1' }, 'admin')).toBe(false);
    });
});

describe('getRoles', () => {
    it('returns empty array for null profile', () => {
        expect(getRoles(null)).toEqual([]);
    });

    it('returns empty array for undefined profile', () => {
        expect(getRoles(undefined)).toEqual([]);
    });

    it('extracts roles from Zitadel format', () => {
        const profile = {
            'urn:zitadel:iam:org:project:roles': { admin: 'p1', viewer: 'p1' },
        };
        const roles = getRoles(profile);
        expect(roles).toContain('admin');
        expect(roles).toContain('viewer');
        expect(roles).toHaveLength(2);
    });

    it('extracts roles from generic array', () => {
        const profile = { roles: ['admin', 'viewer'] };
        expect(getRoles(profile)).toEqual(['admin', 'viewer']);
    });

    it('extracts roles from generic object', () => {
        const profile = { roles: { admin: true, viewer: false } };
        const roles = getRoles(profile);
        expect(roles).toContain('admin');
        expect(roles).toContain('viewer');
    });

    it('deduplicates roles across formats', () => {
        const profile = {
            'urn:zitadel:iam:org:project:roles': { admin: 'p1' },
            roles: ['admin', 'viewer'],
        };
        const roles = getRoles(profile);
        expect(roles).toContain('admin');
        expect(roles).toContain('viewer');
        expect(roles).toHaveLength(2);
    });

    it('filters non-string entries from roles array', () => {
        const profile = { roles: ['admin', 123, null, 'viewer'] };
        const roles = getRoles(profile);
        expect(roles).toEqual(['admin', 'viewer']);
    });

    it('returns empty array when no role claims exist', () => {
        expect(getRoles({ sub: 'user-1' })).toEqual([]);
    });
});
