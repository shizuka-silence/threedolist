import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["public"], // ignore Supabase's internal auth/storage schemas during introspection
  // DIRECT_URL (port 5432) is preferred for migrations; the pooled DATABASE_URL (6543) is the fallback.
  dbCredentials: { url: process.env.DIRECT_URL || process.env.DATABASE_URL! },
});
