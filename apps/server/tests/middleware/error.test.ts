import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { errorHandler } from "../../src/middleware/error";

describe("errorHandler", () => {
  test("returns 500 for generic Error", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new Error("Something broke");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Something broke");
  });

  test("returns custom status from error with status property", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not found");
  });

  test("returns fallback message for Error with empty message", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new Error("");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal Server Error");
  });
});
