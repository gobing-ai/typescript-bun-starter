import { describe, expect, it } from 'bun:test';
import { getValidatedOrigin, isAllowedOrigin, matchOriginPattern } from '../src/origin';

describe('matchOriginPattern', () => {
    it('matches exact origin', () => {
        expect(matchOriginPattern('https://example.com', 'https://example.com')).toBe(true);
    });

    it('matches universal wildcard', () => {
        expect(matchOriginPattern('https://anything.com', '*')).toBe(true);
    });

    it('matches subdomain wildcard', () => {
        expect(matchOriginPattern('https://app.example.com', 'https://*.example.com')).toBe(true);
    });

    it('matches deep subdomain with wildcard', () => {
        expect(matchOriginPattern('https://a.b.example.com', 'https://*.example.com')).toBe(true);
    });

    it('rejects wrong domain with wildcard', () => {
        expect(matchOriginPattern('https://evil.com', 'https://*.example.com')).toBe(false);
    });

    it('rejects missing prefix in wildcard', () => {
        expect(matchOriginPattern('http://app.example.com', 'https://*.example.com')).toBe(false);
    });

    it('rejects wrong suffix in wildcard', () => {
        expect(matchOriginPattern('https://app.example.com', 'https://*.evil.com')).toBe(false);
    });

    it('rejects mismatched origin', () => {
        expect(matchOriginPattern('https://foo.com', 'https://bar.com')).toBe(false);
    });

    it('treats multiple wildcards as literal', () => {
        expect(matchOriginPattern('https://a.*.b.*.com', 'https://a.*.b.*.com')).toBe(true);
        expect(matchOriginPattern('https://a.x.b.y.com', 'https://a.*.b.*.com')).toBe(false);
    });

    it('rejects empty origin with non-empty pattern', () => {
        expect(matchOriginPattern('', 'https://example.com')).toBe(false);
    });
});

describe('isAllowedOrigin', () => {
    const allowed = ['https://example.com', 'https://*.myapp.com', '*'];

    it('returns false for null origin', () => {
        expect(isAllowedOrigin(null, allowed)).toBe(false);
    });

    it('returns false for undefined origin', () => {
        expect(isAllowedOrigin(undefined, allowed)).toBe(false);
    });

    it('returns false for empty allowed list', () => {
        expect(isAllowedOrigin('https://example.com', [])).toBe(false);
    });

    it('returns true for exact match', () => {
        expect(isAllowedOrigin('https://example.com', allowed)).toBe(true);
    });

    it('returns true for wildcard subdomain match', () => {
        expect(isAllowedOrigin('https://sub.myapp.com', allowed)).toBe(true);
    });

    it('returns true for universal wildcard', () => {
        expect(isAllowedOrigin('https://random.com', allowed)).toBe(true);
    });

    it('returns false for disallowed origin', () => {
        expect(isAllowedOrigin('https://evil.com', ['https://example.com'])).toBe(false);
    });
});

describe('getValidatedOrigin', () => {
    const allowed = ['https://secure.com'];

    it('returns origin when allowed', () => {
        expect(getValidatedOrigin('https://secure.com', allowed, 'https://fallback.com')).toBe('https://secure.com');
    });

    it('returns fallback when not allowed', () => {
        expect(getValidatedOrigin('https://evil.com', allowed, 'https://fallback.com')).toBe('https://fallback.com');
    });

    it('returns fallback for null origin', () => {
        expect(getValidatedOrigin(null, allowed, 'https://fallback.com')).toBe('https://fallback.com');
    });
});
