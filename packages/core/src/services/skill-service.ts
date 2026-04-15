import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/adapter';
import { getDb } from '../db/client';
import { skills } from '../db/schema';
import { InternalError, NotFoundError, ValidationError } from '../errors';
import { logger } from '../logger';
import { type NewSkill, type Skill, type SkillUpdate, skillInsertSchema, skillUpdateSchema } from '../schemas/skill';
import type { Result } from '../types/result';

/**
 * Validate and normalize a create input through the core schema.
 *
 * The schema already enforces min(1) / max(100) on `name`, but we add
 * a whitespace-only guard here because z.string().min(1) allows "   ".
 */
function validateCreate(input: NewSkill): NewSkill {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
        throw new ValidationError('name must not be blank');
    }
    if (trimmed.length > 100) {
        throw new ValidationError('name must be at most 100 characters');
    }

    // Run through Zod to enforce the rest of the schema constraints
    const parsed = skillInsertSchema.safeParse({ ...input, name: trimmed });
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new ValidationError(first?.message ?? 'Validation failed');
    }

    return { ...parsed.data, name: trimmed };
}

/**
 * Validate an update input. Fields are optional — we only validate what's present.
 */
function validateUpdate(input: SkillUpdate): SkillUpdate {
    if (input.name !== undefined) {
        const trimmed = input.name.trim();
        if (trimmed.length === 0) {
            throw new ValidationError('name must not be blank');
        }
        if (trimmed.length > 100) {
            throw new ValidationError('name must be at most 100 characters');
        }
        input = { ...input, name: trimmed };
    }

    const parsed = skillUpdateSchema.safeParse(input);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new ValidationError(first?.message ?? 'Validation failed');
    }

    return parsed.data;
}

export class SkillService {
    constructor(private db: Database = getDb()) {}

    async create(input: NewSkill): Promise<Result<Skill>> {
        try {
            const validated = validateCreate(input);

            const id = crypto.randomUUID();
            const now = new Date();
            const rows = await this.db
                .insert(skills)
                .values({
                    id,
                    name: validated.name,
                    description: validated.description ?? null,
                    config: validated.config ?? null,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();
            const row = rows[0];
            if (!row) {
                return { ok: false, error: new InternalError('Failed to create skill') };
            }
            logger.info('Skill created: {id}', { id });
            return { ok: true, data: row };
        } catch (e) {
            // Re-throw validation errors — callers already know how to handle them
            if (e instanceof ValidationError) {
                return { ok: false, error: e };
            }
            return {
                ok: false,
                error: e instanceof Error ? new InternalError(e.message, e) : new InternalError(String(e)),
            };
        }
    }

    async list(): Promise<Result<Skill[]>> {
        try {
            const rows = await this.db.select().from(skills);
            return { ok: true, data: rows };
        } catch (e) {
            return {
                ok: false,
                error: e instanceof Error ? new InternalError(e.message, e) : new InternalError(String(e)),
            };
        }
    }

    async getById(id: string): Promise<Result<Skill>> {
        try {
            const rows = await this.db.select().from(skills).where(eq(skills.id, id));
            const row = rows[0];
            if (!row) {
                return { ok: false, error: new NotFoundError(`Skill not found: ${id}`) };
            }
            return { ok: true, data: row };
        } catch (e) {
            // NotFoundError from the check above — pass through
            if (e instanceof NotFoundError) {
                return { ok: false, error: e };
            }
            return {
                ok: false,
                error: e instanceof Error ? new InternalError(e.message, e) : new InternalError(String(e)),
            };
        }
    }

    async update(id: string, input: SkillUpdate): Promise<Result<Skill>> {
        try {
            const validated = validateUpdate(input);

            // Strip undefined keys so Drizzle doesn't null out columns
            const changes: Record<string, unknown> = {};
            if (validated.name !== undefined) changes.name = validated.name;
            if (validated.description !== undefined) changes.description = validated.description;
            if (validated.config !== undefined) changes.config = validated.config;

            const rows = await this.db
                .update(skills)
                .set({ ...changes, version: sql`${skills.version} + 1`, updatedAt: new Date() })
                .where(eq(skills.id, id))
                .returning();
            const row = rows[0];
            if (!row) {
                return { ok: false, error: new NotFoundError(`Skill not found: ${id}`) };
            }
            logger.info('Skill updated: {id}', { id });
            return { ok: true, data: row };
        } catch (e) {
            if (e instanceof ValidationError) {
                return { ok: false, error: e };
            }
            return {
                ok: false,
                error: e instanceof Error ? new InternalError(e.message, e) : new InternalError(String(e)),
            };
        }
    }

    async delete(id: string): Promise<Result<void>> {
        try {
            const rows = await this.db.delete(skills).where(eq(skills.id, id)).returning();
            if (rows.length === 0) {
                return { ok: false, error: new NotFoundError(`Skill not found: ${id}`) };
            }
            logger.info('Skill deleted: {id}', { id });
            return { ok: true, data: undefined };
        } catch (e) {
            return {
                ok: false,
                error: e instanceof Error ? new InternalError(e.message, e) : new InternalError(String(e)),
            };
        }
    }
}
