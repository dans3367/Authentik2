// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";

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
  db = drizzleNeon(pool, { schema, logger: false });
} else {
  // Use standard PostgreSQL (non-SSL by default)
  const ssl = process.env.DB_SSL === 'true' ? true : false;
  const connectionString = ssl
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL?.replace('?sslmode=require', '');

  const client = postgres(connectionString!, {
    ssl: ssl ? 'require' : false,
    max: 1,
  });

  db = drizzle(client, { schema, logger: false });
}

export { db };
export { schema };
