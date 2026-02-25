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
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL (non-SSL by default)
const ssl = process.env.DB_SSL === 'true';
let connectionString: string;
if (ssl) {
  connectionString = process.env.DATABASE_URL!;
} else {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  dbUrl.searchParams.delete('sslmode');
  connectionString = dbUrl.toString();
}

const client = postgres(connectionString, {
  ssl: ssl ? 'require' : false,
  max: 1,
});

const db = drizzle(client, { schema, logger: false });

export { db };
export { schema };
