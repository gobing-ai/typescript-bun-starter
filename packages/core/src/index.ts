// @starter/core — barrel export

// Config
export { CORE_CONFIG } from './config';
export type { DbAdapter, DbAdapterConfig, DbClient, DbTable } from './db/adapter';
export { createDbAdapter } from './db/adapter';
// Database
export { BaseDao } from './db/base-dao';
export { _resetAdapter, getDb, getDefaultAdapter } from './db/client';
export type { CreateSkillInput, SkillRecord } from './db/skills-dao';
export { SkillsDao } from './db/skills-dao';
export type { ErrorCode } from './errors';
// Errors
export {
    AppError,
    ConflictError,
    InternalError,
    isAppError,
    NotFoundError,
    ValidationError,
} from './errors';
// Logger
export { logger } from './logger';
export { createLoggerSinks, getLoggerConfig } from './logging';
// Types
export type { Result } from './types/result';
