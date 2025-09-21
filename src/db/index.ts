import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const errors = [];

if (!process.env["TURSO_DATABASE_URL"]) {
  errors.push("TURSO_DATABASE_URL missing from .env");
}

if (!process.env["TURSO_AUTH_TOKEN"]) {
  errors.push("TURSO_AUTH_TOKEN missing from .env");
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(err);
  }
  process.exit(1);
}

export const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
  schema: {
    ...schema,
  },
});

async function createIdx() {
  await db.run(`
  CREATE INDEX IF NOT EXISTS query_cache_embedding_idx
  ON query_cache(libsql_vector_idx(embedding, 'metric=cosine'));
`);
}

createIdx();
