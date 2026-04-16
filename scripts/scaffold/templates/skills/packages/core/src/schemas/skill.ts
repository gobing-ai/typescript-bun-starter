import { z } from 'zod';

/**
 * Schema for creating a new skill.
 */
export const createSkillSchema = z.object({
    name: z.string().min(1).max(255),
});

/**
 * Schema for a skill record.
 */
export const skillSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type Skill = z.infer<typeof skillSchema>;
