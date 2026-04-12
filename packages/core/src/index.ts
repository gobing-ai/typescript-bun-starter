// @project/core — barrel export

// Config
export { CORE_CONFIG } from "./config";
export type { Database, DbAdapter, DbAdapterConfig } from "./db/adapter";
export { createDbAdapter } from "./db/adapter";
// Database
export { _resetAdapter, getDb, getDefaultAdapter } from "./db/client";
export type { ErrorCode } from "./errors";
// Errors
export {
  AppError,
  ConflictError,
  InternalError,
  isAppError,
  NotFoundError,
  ValidationError,
} from "./errors";
// Logger
export { logger } from "./logger";
export { getLoggerConfig } from "./logging";
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
