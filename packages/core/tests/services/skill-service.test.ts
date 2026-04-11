import type { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SkillService } from "../../src/services/skill-service";
import { createTestDb } from "../test-db";

describe("SkillService", () => {
  let service: SkillService;
  let sqlite: Database;

  beforeAll(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    service = new SkillService(testDb.db);
  });

  afterAll(() => {
    sqlite.close();
  });

  test("create — returns a skill with generated id and timestamps", async () => {
    const result = await service.create({ name: "test-skill" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("test-skill");
    expect(result.data.id).toBeDefined();
    expect(result.data.version).toBe(1);
    expect(result.data.createdAt).toBeInstanceOf(Date);
    expect(result.data.updatedAt).toBeInstanceOf(Date);
  });

  test("create — with description and config", async () => {
    const result = await service.create({
      name: "web-search",
      description: "Search the web",
      config: { timeout: 5000 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("web-search");
    expect(result.data.description).toBe("Search the web");
    expect(result.data.config).toEqual({ timeout: 5000 });
  });

  test("create — with null description by default", async () => {
    const result = await service.create({ name: "minimal" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.description).toBeNull();
    expect(result.data.config).toBeNull();
  });

  test("list — returns all created skills", async () => {
    await service.create({ name: "skill-a" });
    await service.create({ name: "skill-b" });

    const result = await service.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    const names = result.data.map((s) => s.name);
    expect(names).toContain("skill-a");
    expect(names).toContain("skill-b");
  });

  test("getById — returns skill by id", async () => {
    const created = await service.create({ name: "find-me" });
    if (!created.ok) return;

    const result = await service.getById(created.data.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("find-me");
    expect(result.data.id).toBe(created.data.id);
  });

  test("getById — returns error for missing id", async () => {
    const result = await service.getById("nonexistent-id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Skill not found");
  });

  test("update — updates name and description", async () => {
    const created = await service.create({ name: "original" });
    if (!created.ok) return;

    const result = await service.update(created.data.id, {
      name: "updated",
      description: "new desc",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("updated");
    expect(result.data.description).toBe("new desc");
    expect(result.data.version).toBe(created.data.version + 1);
    expect(result.data.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.data.updatedAt.getTime(),
    );
  });

  test("update — returns error for missing id", async () => {
    const result = await service.update("nonexistent-id", { name: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Skill not found");
  });

  test("delete — removes a skill", async () => {
    const created = await service.create({ name: "delete-me" });
    if (!created.ok) return;

    const result = await service.delete(created.data.id);
    expect(result.ok).toBe(true);

    const found = await service.getById(created.data.id);
    expect(found.ok).toBe(false);
  });

  test("delete — returns error for missing id", async () => {
    const result = await service.delete("nonexistent-id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Skill not found");
  });

  test("full CRUD lifecycle", async () => {
    const created = await service.create({
      name: "lifecycle",
      description: "test desc",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const id = created.data.id;

    const got = await service.getById(id);
    expect(got.ok).toBe(true);

    const updated = await service.update(id, { name: "lifecycle-v2" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.name).toBe("lifecycle-v2");

    const deleted = await service.delete(id);
    expect(deleted.ok).toBe(true);

    const afterDelete = await service.getById(id);
    expect(afterDelete.ok).toBe(false);
  });
});
