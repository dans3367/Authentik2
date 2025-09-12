import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Check database type from environment variable (default to 'postgres')
const dbType = process.env.DB_TYPE || 'postgres';

let dbCredentials: any;

if (dbType === 'neon') {
  // Use NeonDB configuration
  dbCredentials = {
    url: process.env.DATABASE_URL,
  };
} else {
  // Use standard PostgreSQL configuration
  const ssl = process.env.DB_SSL === 'true' ? true : false;
  const connectionString = ssl
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL?.replace('?sslmode=require', '');

  dbCredentials = {
    url: connectionString || process.env.DATABASE_URL!,
  };
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials,
});
