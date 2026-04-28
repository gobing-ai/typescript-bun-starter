/**
 * Origin validation for CORS and redirect URL safety.
 *
 * Uses simple string matching with single-wildcard support.
 * Deliberately avoids regex to prevent ReDoS attacks.
 */

export function matchOriginPattern(origin: string, pattern: string): boolean {
    if (pattern === origin) return true;
    if (pattern === '*') return true;

    if (pattern.includes('*')) {
        const parts = pattern.split('*');
        if (parts.length !== 2) {
            return pattern === origin;
        }
        const [p, s] = parts;
        if (p === undefined || s === undefined) return false;
        return origin.startsWith(p) && origin.endsWith(s) && origin.length >= p.length + s.length;
    }

    return false;
}

export function isAllowedOrigin(origin: string | undefined | null, allowedOrigins: string[]): boolean {
    if (!origin) return false;
    if (!allowedOrigins || allowedOrigins.length === 0) return false;

    return allowedOrigins.some((pattern) => matchOriginPattern(origin, pattern));
}

export function getValidatedOrigin(
    origin: string | undefined | null,
    allowedOrigins: string[],
    fallback: string,
): string {
    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
        return origin;
    }
    return fallback;
}
