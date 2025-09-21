import { QUERY_CACHE_VERSION } from "@/consts";
import { sql } from "drizzle-orm";
import {
  blob,
  customType,
  int,
  sqliteTable,
} from "drizzle-orm/sqlite-core";

const float32Array = customType<{
  data: number[];
  config: { dimensions: number };
  driverData: Buffer;
}>({
  dataType(config) {
    return `F32_BLOB(${config?.dimensions ?? 1536})`;
  },
  fromDriver(value: Buffer) {
    const buf = value;
    const floatArray = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.length / 4
    );
    return Array.from(floatArray);
  },
  toDriver(value: number[]) {
    // Inline the array as a string literal in SQL
    const vecLiteral = `[${value.join(",")}]`;
    return sql.raw(`vector('${vecLiteral}')`);
  },
});

// map query vector -> audio blob
export const queryCache = sqliteTable("query_cache", {
  id: int().primaryKey({ autoIncrement: true }),
  embedding: float32Array({ dimensions: 1536 }).notNull(),
  output: blob({ mode: "buffer" }).notNull(),
  version: int().notNull().default(QUERY_CACHE_VERSION),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});
