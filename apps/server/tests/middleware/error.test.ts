import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ConflictError, InternalError, NotFoundError, ValidationError } from "@project/core";
import { errorHandler } from "../../src/middleware/error";

describe("errorHandler", () => {
  test("returns 500 with sanitized message for generic Error", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new Error("Something broke");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: string };
    // Generic errors are sanitized — internal details must not leak
    expect(body.error).toBe("Internal Server Error");
  });

  test("returns 404 for NotFoundError", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new NotFoundError("Record not found");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Record not found");
  });

  test("returns 400 for ValidationError", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new ValidationError("name is invalid");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("name is invalid");
  });

  test("returns 409 for ConflictError", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new ConflictError("duplicate");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(409);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("duplicate");
  });

  test("returns 500 for InternalError with message preserved", async () => {
    const app = new OpenAPIHono();
    app.onError(errorHandler());
    app.get("/fail", () => {
      throw new InternalError("db connection lost");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: string };
    // InternalError IS an AppError, so the message is preserved
    expect(body.error).toBe("db connection lost");
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
