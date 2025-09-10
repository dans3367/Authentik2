import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check database type from environment variable (default to 'postgres')
const dbType = process.env.DB_TYPE || 'postgres';

let pool: any;
let db: any;

if (dbType === 'neon') {
  // Use NeonDB with WebSocket support
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema, logger: true });
} else {
  // Use standard PostgreSQL (non-SSL by default)
  const ssl = process.env.DB_SSL === 'true' ? true : false;
  const connectionString = ssl
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL?.replace('?sslmode=require', '');

  pool = postgres(connectionString || process.env.DATABASE_URL!, {
    ssl: ssl ? 'require' : false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  db = drizzle(pool, { schema, logger: true });
}

export { pool, db };
