import type { MiddlewareHandler } from "hono";

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const expectedKey = process.env.API_KEY;

    // Dev mode: skip auth when API_KEY is not configured
    if (!expectedKey) {
      return next();
    }

    const headerKey = c.req.header("X-API-Key");
    const queryKey = c.req.query("api_key");
    const providedKey = headerKey || queryKey;

    if (!providedKey || providedKey !== expectedKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}
