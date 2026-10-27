import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // DIRECT_URL bypasses PgBouncer — required for DDL statements in migrations.
    // DATABASE_URL (transaction pooler) is used by PrismaClient at runtime.
    url: env("DIRECT_URL"),
  },
});
