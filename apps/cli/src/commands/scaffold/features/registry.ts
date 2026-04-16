import type { FeatureDefinition } from '../types/scaffold';

/**
 * Required features that cannot be removed.
 */
export const REQUIRED_FEATURES = ['contracts', 'core'] as const;

/**
 * Optional features that can be added/removed.
 */
export const OPTIONAL_FEATURES = ['cli', 'server', 'webapp', 'skills'] as const;

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
        description: 'Clipanion-based CLI tool for project commands',
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
            'apps/server/src/routes/.gitkeep',
            'apps/server/src/middleware/.gitkeep',
            'apps/server/tests/.gitkeep',
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
            'apps/web/package.json',
        ],
        rewrites: {},
        packages: ['@starter/web'],
        workspacePath: 'apps/web',
    },
    skills: {
        name: 'Skills',
        description: 'Skill management domain with CRUD operations',
        files: [
            // Core
            'packages/core/src/schemas/skill.ts',
            'packages/core/src/services/skill-service.ts',
            'packages/core/tests/services/skill-service.test.ts',
            // CLI
            'apps/cli/src/commands/skill-create.ts',
            'apps/cli/src/commands/skill-delete.ts',
            'apps/cli/src/commands/skill-get.ts',
            'apps/cli/src/commands/skill-list.ts',
            'apps/cli/tests/commands/skill-create.test.ts',
            'apps/cli/tests/commands/skill-delete.test.ts',
            'apps/cli/tests/commands/skill-get.test.ts',
            'apps/cli/tests/commands/skill-list.test.ts',
            // Server
            'apps/server/src/routes/skills.ts',
            'apps/server/tests/routes/skills.test.ts',
        ],
        rewrites: {},
        packages: [],
        workspacePath: undefined, // Skills extends core, not a separate workspace
    },
};

/**
 * Baseline content for files that need rewrites when removing a feature.
 * Maps file path to baseline content.
 */
export const BASELINE_FILES: Record<string, string> = {
    'packages/core/src/db/schema.ts': `// Add your Drizzle table definitions here.
export {};
`,

    'packages/core/src/config.ts': `/**
 * Core package configuration.
 *
 * Compile-time constants and runtime defaults for @starter/core.
 */
export const CORE_CONFIG = {
  /** Default SQLite database path when DATABASE_URL is not set */
  defaultDbPath: "data/app.db",

  /** SQLite pragmas applied on connection */
  pragmas: {
    journalMode: "PRAGMA journal_mode = WAL",
    synchronous: "PRAGMA synchronous = NORMAL",
    foreignKeys: "PRAGMA foreign_keys = ON",
  },
} as const;
`,

    'packages/core/src/index.ts': `// @starter/core — barrel export

// Config
export { CORE_CONFIG } from "./config";
export type { Database, DbAdapter, DbAdapterConfig } from "./db/adapter";
export { createDbAdapter } from "./db/adapter";
// Database
export { _resetAdapter, getDb, getDefaultAdapter } from "./db/client";
export type { ErrorCode } from "./errors";
// Errors
export {
  AppError,
  ConflictError,
  InternalError,
  isAppError,
  NotFoundError,
  ValidationError,
} from "./errors";
// Logger
export { logger } from "./logger";
export { getLoggerConfig } from "./logging";
// Types
export type { Result } from "./types/result";
`,

    'apps/cli/src/index.ts': `#!/usr/bin/env bun
import { Writable } from "node:stream";
import { configure, getConsoleSink, getStreamSink } from "@logtape/logtape";
import { getLoggerConfig } from "@starter/core";
import { Builtins, Cli } from "clipanion";

import { CLI_CONFIG } from "./config";

// Detect JSON agent mode before logging is configured.
const isJsonMode = process.argv.includes("--json");

await configure({
    ...getLoggerConfig(process.env),
    sinks: {
        console: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
    },
});

const cli = new Cli({
    binaryLabel: CLI_CONFIG.binaryLabel,
    binaryName: CLI_CONFIG.binaryName,
    binaryVersion: CLI_CONFIG.binaryVersion,
});

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2));
`,

    'apps/server/src/index.ts': `// @starter/server — entry point

import { Writable } from "node:stream";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { configure, getStreamSink } from "@logtape/logtape";
import type { Database, DbAdapterConfig } from "@starter/core";
import { createDbAdapter, getLoggerConfig } from "@starter/core";
import { SERVER_CONFIG } from "./config";
import { errorHandler } from "./middleware/error";

type D1Binding = Extract<DbAdapterConfig, { driver: "d1" }>["binding"];

type ServerEnv = {
    Bindings: {
        API_KEY?: string;
        DB?: D1Binding;
    };
    Variables: {
        db: Database;
    };
};

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
    ...getLoggerConfig(process.env),
    sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
});

export function createApp(localDb?: Database) {
    const app = new OpenAPIHono<ServerEnv>();

    app.onError(errorHandler());
    app.notFound(() => new Response(null, { status: 404 }));

    // Database middleware
    app.use("*", async (c, next) => {
        if (localDb) {
            c.set("db", localDb);
            await next();
            return;
        }

        const dbBinding = c.env.DB;
        if (dbBinding) {
            const adapter = await createDbAdapter({ driver: "d1", binding: dbBinding });
            c.set("db", adapter.getDb());
        } else {
            const adapter = await createDbAdapter({
                driver: "bun-sqlite",
                url: process.env.DATABASE_URL ?? "data/app.db",
            });
            c.set("db", adapter.getDb());
        }
        await next();
    });

    // Health
    app.get("/", (c) => {
        return c.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Swagger UI
    app.get("/swagger", swaggerUI({ url: "/doc" }));

    // OpenAPI spec
    app.doc("/doc", (_c) => ({
        openapi: "3.0.0",
        info: {
            title: SERVER_CONFIG.apiTitle,
            version: SERVER_CONFIG.apiVersion,
        },
        paths: {},
    }));

    return app;
}

default export {
    fetch: (request: Request, env?: Record<string, unknown>) => {
        const app = createApp();
        return app.fetch(request, env ?? {});
    },
};
`,
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
