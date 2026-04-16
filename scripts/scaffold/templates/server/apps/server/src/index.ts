// @starter/server — entry point

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

    // API Health
    app.get("/api/health", (c) => {
        return c.json({
            data: {
                status: "ok",
                timestamp: new Date().toISOString(),
            },
        });
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

export default {
    fetch: (request: Request, env?: Record<string, unknown>) => {
        const app = createApp();
        return app.fetch(request, env ?? {});
    },
};
