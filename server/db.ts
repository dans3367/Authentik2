import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL with SSL detection from DATABASE_URL
const databaseUrl = process.env.DATABASE_URL!;
const requiresSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech');

const pool = postgres(databaseUrl, {
  ssl: requiresSSL ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(pool, { schema, logger: false });

export { pool, db };
