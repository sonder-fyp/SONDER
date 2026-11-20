import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let query: NeonQueryFunction<false, false> | undefined;

export function database() {
  if (query) return query;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  query = neon(connectionString);
  return query;
}
