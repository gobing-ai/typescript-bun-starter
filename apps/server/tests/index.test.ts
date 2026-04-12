import { afterEach, describe, expect, test } from "bun:test";
import { createTestDb } from "@project/core/tests/test-db";
import { createApp } from "../src/index";

const cleanupFns: Array<() => void> = [];

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.();
  }
});

function makeApp() {
  const { sqlite, db } = createTestDb();
  cleanupFns.push(() => sqlite.close());
  return createApp(db);
}

describe("server entry", () => {
  test("GET / returns health status", async () => {
    const app = makeApp();
    const res = await app.request("/");

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("GET /doc returns OpenAPI JSON", async () => {
    const app = makeApp();
    const res = await app.request("/doc");

    expect(res.status).toBe(200);

    const body = (await res.json()) as { openapi: string; info: { title: string } };
    expect(body.openapi).toBe("3.0.0");
    expect(body.info.title).toBe("TypeScript Bun Starter API");
  });

  test("GET /swagger returns Swagger UI HTML", async () => {
    const app = makeApp();
    const res = await app.request("/swagger");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("swagger");
  });

  test("serves skill routes using the app-scoped database resolver", async () => {
    const app = makeApp();

    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "entrypoint-skill" }),
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as { data: { name: string } };
    expect(body.data.name).toBe("entrypoint-skill");
  });

  test("uses request D1 binding when available", async () => {
    const app = makeApp();
    const binding = {} as D1Database;

    const res = await app.request("/", undefined, { DB: binding });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
