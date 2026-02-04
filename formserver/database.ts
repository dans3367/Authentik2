import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Use standard PostgreSQL with SSL detection from DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
const requiresSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech');

const sql = postgres(databaseUrl, {
  ssl: requiresSSL ? { rejectUnauthorized: true } : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { logger: false });