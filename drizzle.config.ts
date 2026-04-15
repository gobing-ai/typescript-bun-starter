import type { Config } from 'drizzle-kit';
import { CORE_CONFIG } from './packages/core/src/config';

export default {
    schema: './packages/core/src/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? CORE_CONFIG.defaultDbPath,
    },
} satisfies Config;
