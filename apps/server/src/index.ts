// @project/server — entry point

import { Writable } from "node:stream";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { configure, getStreamSink } from "@logtape/logtape";
import type { Database, DbAdapterConfig } from "@project/core";
import { createDbAdapter } from "@project/core";
import { SERVER_CONFIG } from "./config";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { createSkillRoutes } from "./routes/skills";

type D1Binding = Extract<DbAdapterConfig, { driver: "d1" }>["binding"];

interface ServerEnv {
  API_KEY?: string;
  DB?: D1Binding;
}

interface ServerVariables {
  db: Database;
}

// Configure LogTape — always to stderr so stdout is never polluted
await configure({
  sinks: { console: getStreamSink(Writable.toWeb(process.stderr)) },
  loggers: [
    {
      category: "tbs",
      lowestLevel: "info",
      sinks: ["console"],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: [],
    },
  ],
});

export function createApp(localDb: Database) {
  const app = new OpenAPIHono<{ Bindings: ServerEnv; Variables: ServerVariables }>();

  app.use("*", async (c, next) => {
    const binding = c.env && "DB" in c.env ? c.env.DB : undefined;

    if (binding) {
      const adapter = await createDbAdapter({ driver: "d1", binding });
      c.set("db", adapter.getDb());
    } else {
      c.set("db", localDb);
    }
    await next();
  });

  // Global middleware
  app.onError(errorHandler());
  app.use(`${SERVER_CONFIG.apiPrefix}/*`, authMiddleware());

  // Mount routes — resolve DB per request so Bun local and Workers D1 both work.
  app.route(
    SERVER_CONFIG.apiPrefix,
    createSkillRoutes({
      getDb: (c) => c.var.db,
    }),
  );

  // OpenAPI documentation
  app.doc(SERVER_CONFIG.docPath, {
    openapi: "3.0.0",
    info: { title: "TypeScript Bun Starter API", version: "0.1.0" },
  });
  app.get(SERVER_CONFIG.swaggerPath, swaggerUI({ url: SERVER_CONFIG.docPath }));

  // Health check
  app.get("/", (c) => c.json({ status: "ok" }));

  return app;
}

// Construct the Bun local adapter explicitly so the server owns its runtime choice.
const localAdapter = await createDbAdapter({
  driver: "bun-sqlite",
  url: process.env.DATABASE_URL,
});

const app = createApp(localAdapter.getDb());

// Export AppType for typed RPC client reuse (hono/client)
export type AppType = typeof app;

export default {
  port: Number.isFinite(Number(process.env.PORT))
    ? Number(process.env.PORT)
    : SERVER_CONFIG.defaultPort,
  fetch: app.fetch,
};
