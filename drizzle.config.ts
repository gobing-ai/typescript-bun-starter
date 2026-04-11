import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/core/src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "data/app.db",
  },
} satisfies Config;
