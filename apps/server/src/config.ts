/**
 * Server package configuration.
 *
 * Typed runtime config for @project/server. Environment-dependent values
 * are resolved at startup and frozen into this object.
 */
export const SERVER_CONFIG = {
    /** Default HTTP port when PORT env is not set */
    defaultPort: 3000,

    /** API route prefix */
    apiPrefix: '/api',

    /** OpenAPI spec endpoint */
    docPath: '/doc',

    /** Swagger UI endpoint */
    swaggerPath: '/swagger',
} as const;
