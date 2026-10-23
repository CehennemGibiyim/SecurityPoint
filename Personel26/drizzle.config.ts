import { defineConfig } from "drizzle-kit";

// CI ve sunucu ortamında DATABASE_URL kullanılır; yoksa yerel varsayılan.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
