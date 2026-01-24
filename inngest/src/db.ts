import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });

const { Pool } = pg;

console.log("📧 [DB] Connecting to PostgreSQL:", {
  host: process.env.PGHOST || "100.96.48.14",
  port: process.env.PGPORT || "5432",
  user: process.env.PGUSER || "postgres",
  database: process.env.PGDATABASE || "neon",
});

const pool = new Pool({
  host: process.env.PGHOST || "100.96.48.14",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "neon",
  ssl: false,
});

// Test connection on startup
pool.query("SELECT NOW()").then((res) => {
  console.log("📧 [DB] Connection successful:", res.rows[0]);
}).catch((err) => {
  console.error("📧 [DB] Connection failed:", err.message);
});

export const db = drizzle(pool);
