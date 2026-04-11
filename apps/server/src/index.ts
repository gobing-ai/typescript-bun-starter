// @project/server — entry point

import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { configure, getConsoleSink } from "@logtape/logtape";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import skillRoutes from "./routes/skills";

// Configure LogTape
await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    {
      category: "tbs",
      lowestLevel: "info",
      sinks: ["console"],
    },
  ],
});

const app = new OpenAPIHono();

// Global middleware
app.onError(errorHandler());
app.use("/api/*", authMiddleware());

// Mount routes
app.route("/api", skillRoutes);

// OpenAPI documentation
app.doc("/doc", {
  openapi: "3.0.0",
  info: { title: "TypeScript Bun Starter API", version: "0.1.0" },
});
app.get("/swagger", swaggerUI({ url: "/doc" }));

// Health check
app.get("/", (c) => c.json({ status: "ok" }));

export default {
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
};
