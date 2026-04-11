import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import skillRoutes from "../../src/routes/skills";

// The skillRoutes module creates a SkillService with the default db.
// Ensure the table exists in that database before tests run.

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    config TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

const DB_PATH = process.env.DATABASE_URL || "data/app.db";

beforeAll(() => {
  const sqlite = new Database(DB_PATH, { create: true });
  sqlite.run(CREATE_TABLE_SQL);
  sqlite.run("DELETE FROM skills");
  sqlite.close();
});

function makeApp() {
  const app = new OpenAPIHono();
  app.route("/api", skillRoutes);
  return app;
}

describe("Skills API — GET /skills", () => {
  test("returns empty array when no skills exist", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("Skills API — POST /skills", () => {
  test("creates a new skill and returns 201", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test-skill", description: "A test" }),
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      data: { name: string; description: string; id: string };
    };
    expect(body.data.name).toBe("test-skill");
    expect(body.data.description).toBe("A test");
    expect(body.data.id).toBeDefined();
  });

  test("returns 400 for empty body", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("Skills API — GET /skills/{id}", () => {
  test("returns skill by id", async () => {
    const app = makeApp();

    const createRes = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "findable" }),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const res = await app.request(`/api/skills/${created.data.id}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { name: string; id: string } };
    expect(body.data.name).toBe("findable");
  });

  test("returns 404 for missing id", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("Skills API — PATCH /skills/{id}", () => {
  test("updates a skill and returns 200", async () => {
    const app = makeApp();

    const createRes = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "patchable" }),
    });
    const created = (await createRes.json()) as { data: { id: string; version: number } };

    const res = await app.request(`/api/skills/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "patched-name" }),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { name: string; version: number } };
    expect(body.data.name).toBe("patched-name");
    expect(body.data.version).toBe(created.data.version + 1);
  });

  test("returns 404 for missing id", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("Skills API — DELETE /skills/{id}", () => {
  test("deletes a skill and returns 200", async () => {
    const app = makeApp();

    const createRes = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "deletable" }),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const res = await app.request(`/api/skills/${created.data.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: null };
    expect(body.data).toBeNull();
  });

  test("returns 404 for missing id", async () => {
    const app = makeApp();
    const res = await app.request("/api/skills/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
