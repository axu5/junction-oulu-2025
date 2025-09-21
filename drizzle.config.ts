import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env" });

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env["TURSO_DATABASE_URL"]!,
    authToken: process.env["TURSO_AUTH_TOKEN"]!,
  },
});
