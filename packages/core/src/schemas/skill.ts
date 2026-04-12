import { z } from "@hono/zod-openapi";
import { CORE_CONFIG } from "../config";

const { nameMinLength, nameMaxLength } = CORE_CONFIG.skill;

export const skillSelectSchema = z
  .object({
    id: z.string().openapi({ example: "abc-123" }),
    name: z.string().openapi({ example: "web-search" }),
    description: z.string().nullable().openapi({ example: "Search the web" }),
    version: z.number().openapi({ example: 1 }),
    config: z
      .unknown()
      .nullable()
      .openapi({ example: { timeout: 5000 } }),
    createdAt: z.coerce.date().openapi({ example: "2026-04-10T00:00:00.000Z" }),
    updatedAt: z.coerce.date().openapi({ example: "2026-04-10T00:00:00.000Z" }),
  })
  .openapi("Skill");

export const skillInsertSchema = z
  .object({
    name: z.string().min(nameMinLength).max(nameMaxLength).openapi({ example: "web-search" }),
    description: z.string().optional().openapi({ example: "Search the web" }),
    config: z
      .unknown()
      .optional()
      .openapi({ example: { timeout: 5000 } }),
  })
  .openapi("NewSkill");

export const skillUpdateSchema = z
  .object({
    name: z
      .string()
      .min(nameMinLength)
      .max(nameMaxLength)
      .optional()
      .openapi({ example: "web-search" }),
    description: z.string().optional().openapi({ example: "Updated description" }),
    config: z
      .unknown()
      .optional()
      .openapi({ example: { timeout: 10000 } }),
  })
  .openapi("UpdateSkill");

export type Skill = z.infer<typeof skillSelectSchema>;
export type NewSkill = z.infer<typeof skillInsertSchema>;
export type SkillUpdate = z.infer<typeof skillUpdateSchema>;
