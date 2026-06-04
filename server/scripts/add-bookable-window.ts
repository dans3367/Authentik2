import "../config";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";

// Adds the optional bookable-window columns to user_availability.
// Idempotent — safe to re-run (IF NOT EXISTS).
async function main() {
  console.log("🔧 Adding bookable window columns to user_availability...");
  await db.execute(sql`
    ALTER TABLE "user_availability"
      ADD COLUMN IF NOT EXISTS "bookable_start_date" text,
      ADD COLUMN IF NOT EXISTS "bookable_end_date" text
  `);
  console.log("✅ Done.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
