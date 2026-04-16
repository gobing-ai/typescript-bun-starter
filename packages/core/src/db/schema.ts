import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const skills = sqliteTable('skills', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    version: integer('version').notNull().default(1),
    config: text('config'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});
