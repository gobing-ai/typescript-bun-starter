import type { DbClient } from './adapter';
import { EntityDao } from './entity-dao';
import { skills } from './schema';

export interface CreateSkillInput {
    name: string;
    description?: string | null;
    version?: number;
    config?: string | null;
}

export interface ListSkillsOptions {
    /** Maximum rows to return. Clamped to [1, {@link MAX_LIST_SKILLS_LIMIT}]. */
    limit?: number;
    /** Number of rows to skip. Clamped to >= 0. */
    offset?: number;
}

/** Default page size when caller does not specify a limit. */
export const DEFAULT_LIST_SKILLS_LIMIT = 100;
/** Hard upper bound on a single `listSkills` page. */
export const MAX_LIST_SKILLS_LIMIT = 500;

export type SkillRecord = typeof skills.$inferSelect;

/**
 * DAO for the skills table.
 *
 * Extends EntityDao for generic CRUD operations (create, findById, findAll,
 * update, delete, list, count). Adds skill-specific methods below.
 */
export class SkillsDao extends EntityDao<typeof skills, typeof skills.id> {
    constructor(db: DbClient) {
        super(db, skills, skills.id, 'skills');
    }

    /**
     * Create a new skill record.
     */
    async createSkill(input: CreateSkillInput): Promise<SkillRecord> {
        return this.create({
            id: crypto.randomUUID(),
            name: input.name,
            description: input.description ?? null,
            version: input.version ?? 1,
            config: input.config ?? null,
        }) as Promise<SkillRecord>;
    }

    /**
     * List skills with pagination. Always bounded — never streams the whole
     * table. Defaults to {@link DEFAULT_LIST_SKILLS_LIMIT}; capped at
     * {@link MAX_LIST_SKILLS_LIMIT}.
     */
    async listSkills(options: ListSkillsOptions = {}): Promise<SkillRecord[]> {
        const limit = clampLimit(options.limit);
        const offset = clampOffset(options.offset);

        return this.list({ limit, offset }) as Promise<SkillRecord[]>;
    }
}

function clampLimit(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return DEFAULT_LIST_SKILLS_LIMIT;
    const truncated = Math.trunc(value);
    if (truncated < 1) return 1;
    if (truncated > MAX_LIST_SKILLS_LIMIT) return MAX_LIST_SKILLS_LIMIT;
    return truncated;
}

function clampOffset(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return 0;
    const truncated = Math.trunc(value);
    return truncated < 0 ? 0 : truncated;
}
