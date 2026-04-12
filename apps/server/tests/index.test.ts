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
});
