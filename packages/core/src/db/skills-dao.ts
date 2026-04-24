import type { DbClient } from './adapter';
import { BaseDao } from './base-dao';
import { skills } from './schema';

export interface CreateSkillInput {
    name: string;
    description?: string | null;
    version?: number;
    config?: string | null;
}

export type SkillRecord = typeof skills.$inferSelect;

export class SkillsDao extends BaseDao {
    constructor(db: DbClient) {
        super(db);
    }

    async createSkill(input: CreateSkillInput): Promise<SkillRecord> {
        return this.withMetrics('insert', 'skills', async () => {
            const now = this.now();
            const record: SkillRecord = {
                id: crypto.randomUUID(),
                name: input.name,
                description: input.description ?? null,
                version: input.version ?? 1,
                config: input.config ?? null,
                createdAt: now,
                updatedAt: now,
            };

            await this.db.insert(skills).values(record);

            return record;
        });
    }

    async listSkills(): Promise<SkillRecord[]> {
        return this.withMetrics('select', 'skills', async () => {
            return this.db.select().from(skills);
        });
    }
}
