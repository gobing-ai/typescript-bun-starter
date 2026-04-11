// @project/core — barrel export

export type { Database, DbAdapter, DbAdapterConfig } from "./db/adapter";
export { createDbAdapter } from "./db/adapter";
// Database
export { db, defaultAdapter } from "./db/client";
// Logger
export { logger } from "./logger";
export type { NewSkill, Skill, SkillUpdate } from "./schemas/skill";
// Schemas
export {
  skillInsertSchema,
  skillSelectSchema,
  skillUpdateSchema,
} from "./schemas/skill";
// Services
export { SkillService } from "./services/skill-service";
// Types
export type { Result } from "./types/result";
