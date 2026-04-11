import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/adapter";
import { db as defaultDb } from "../db/client";
import { skills } from "../db/schema";
import { logger } from "../logger";
import type { NewSkill, Skill, SkillUpdate } from "../schemas/skill";
import type { Result } from "../types/result";

export class SkillService {
  constructor(private db: Database = defaultDb) {}

  async create(input: NewSkill): Promise<Result<Skill>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const rows = await this.db
        .insert(skills)
        .values({
          id,
          name: input.name,
          description: input.description ?? null,
          config: input.config ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const row = rows[0];
      if (!row) {
        return { ok: false, error: new Error("Failed to create skill") };
      }
      logger.info("Skill created: {id}", { id });
      return { ok: true, data: row };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async list(): Promise<Result<Skill[]>> {
    try {
      const rows = await this.db.select().from(skills);
      return { ok: true, data: rows };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async getById(id: string): Promise<Result<Skill>> {
    try {
      const rows = await this.db.select().from(skills).where(eq(skills.id, id));
      const row = rows[0];
      if (!row) {
        return { ok: false, error: new Error(`Skill not found: ${id}`) };
      }
      return { ok: true, data: row };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async update(id: string, input: Partial<SkillUpdate>): Promise<Result<Skill>> {
    try {
      const rows = await this.db
        .update(skills)
        .set({ ...input, version: sql`${skills.version} + 1`, updatedAt: new Date() })
        .where(eq(skills.id, id))
        .returning();
      const row = rows[0];
      if (!row) {
        return { ok: false, error: new Error(`Skill not found: ${id}`) };
      }
      logger.info("Skill updated: {id}", { id });
      return { ok: true, data: row };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      const rows = await this.db.delete(skills).where(eq(skills.id, id)).returning();
      if (rows.length === 0) {
        return { ok: false, error: new Error(`Skill not found: ${id}`) };
      }
      logger.info("Skill deleted: {id}", { id });
      return { ok: true, data: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
}
