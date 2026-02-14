import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL!;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function run() {
  try {
    await sql`ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS puck_data text`;
    console.log('Migration successful: puck_data column added to newsletters table');
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
