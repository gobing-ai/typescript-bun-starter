import { logger } from "@project/core";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function errorHandler() {
  return (err: Error, c: Context) => {
    logger.error("Unhandled error: {message}", {
      message: err.message,
      stack: err.stack,
    });

    const status =
      "status" in err && typeof err.status === "number"
        ? (err.status as ContentfulStatusCode)
        : (500 as ContentfulStatusCode);

    return c.json({ error: err.message || "Internal Server Error" }, status);
  };
}
