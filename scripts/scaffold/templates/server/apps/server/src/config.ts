/**
 * Server package configuration.
 *
 * Typed runtime config for @starter/server. Environment-dependent values
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

    /** API title for OpenAPI spec */
    apiTitle: 'TypeScript Bun Starter API',

    /** API version for OpenAPI spec */
    apiVersion: '0.1.0',
} as const;
