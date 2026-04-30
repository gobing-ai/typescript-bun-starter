// Schema barrel — re-exports all tables and column helpers.
//
// drizzle.config.ts points here via glob: ./packages/core/src/db/schema/**/*.ts
// Application code imports from './schema' (this barrel) or './schema/<domain>'.

export * from './common';
export * from './queue-jobs';
