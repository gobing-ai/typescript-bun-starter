import type { Database } from "../db/adapter";
import { skills } from "../db/schema";
import { logger } from "../logger";
import type { CreateSkillInput, Skill } from "../schemas/skill";

/**
 * Service for skill CRUD operations.
 */
export class SkillService {
    constructor(private readonly db: Database) {}

    async create(input: CreateSkillInput): Promise<Skill> {
        const now = Date.now();
        const id = crypto.randomUUID();

        await this.db.insert(skills).values({
            id,
            name: input.name,
            createdAt: now,
            updatedAt: now,
        });

        logger.info("Skill created: {name}", { name: input.name });

        return { id, name: input.name, createdAt: now, updatedAt: now };
    }

    async list(): Promise<Skill[]> {
        return this.db.select().from(skills);
    }

    async get(id: string): Promise<Skill | undefined> {
        const rows = await this.db.select().from(skills).limit(1);
        return rows[0];
    }

    async delete(id: string): Promise<boolean> {
        await this.db.delete(skills);
        logger.info("Skill deleted: {id}", { id });
        return true;
    }
}
