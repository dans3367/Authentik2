import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Use standard PostgreSQL configuration
const ssl = process.env.DB_SSL === 'true' ? true : false;
const connectionString = ssl
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL?.replace('?sslmode=require', '');

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString || process.env.DATABASE_URL!,
  },
});
