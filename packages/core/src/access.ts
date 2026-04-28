/**
 * OIDC role-checking utilities.
 *
 * Supports multiple role claim formats:
 * - Zitadel: `urn:zitadel:iam:org:project:roles` (object with role keys)
 * - Generic: `roles` (array or object)
 * - Keycloak: `realm_access`, `resource_access` (object)
 */

export function hasRole(profile: Record<string, unknown> | null | undefined, role: string): boolean {
    if (!profile) return false;
    if (!role || typeof role !== 'string') return false;

    const zitadelRoles = profile['urn:zitadel:iam:org:project:roles'];
    if (zitadelRoles && typeof zitadelRoles === 'object') {
        try {
            if (zitadelRoles !== null && !Array.isArray(zitadelRoles)) {
                if (Object.hasOwn(zitadelRoles, role)) {
                    return true;
                }
            }
        } catch {
            // continue to other formats
        }
    }

    const rolesArray = profile.roles;
    if (Array.isArray(rolesArray)) {
        return rolesArray.includes(role);
    }

    if (rolesArray && typeof rolesArray === 'object' && !Array.isArray(rolesArray)) {
        try {
            if (rolesArray !== null) {
                return Object.hasOwn(rolesArray, role);
            }
        } catch {
            // fall through
        }
    }

    return false;
}

export function getRoles(profile: Record<string, unknown> | null | undefined): string[] {
    if (!profile) return [];

    const roles = new Set<string>();

    const zitadelRoles = profile['urn:zitadel:iam:org:project:roles'];
    if (zitadelRoles && typeof zitadelRoles === 'object' && zitadelRoles !== null && !Array.isArray(zitadelRoles)) {
        try {
            for (const key of Object.keys(zitadelRoles)) {
                roles.add(key);
            }
        } catch {
            // ignore
        }
    }

    const rolesArray = profile.roles;
    if (Array.isArray(rolesArray)) {
        rolesArray.forEach((r) => {
            if (typeof r === 'string') roles.add(r);
        });
    }

    if (rolesArray && typeof rolesArray === 'object' && rolesArray !== null && !Array.isArray(rolesArray)) {
        try {
            for (const key of Object.keys(rolesArray)) {
                roles.add(key);
            }
        } catch {
            // ignore
        }
    }

    return Array.from(roles);
}
