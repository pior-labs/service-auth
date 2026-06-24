import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../.env" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@postgres:5432/auth",
  },
});
