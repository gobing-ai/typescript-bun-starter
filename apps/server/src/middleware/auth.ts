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

    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to keep timing consistent
    b = a;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
