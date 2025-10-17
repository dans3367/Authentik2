import postgres from 'postgres';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Make sure you have a .env file with DATABASE_URL defined');
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔧 Running migration to create custom_cards table...');

    // Read and run the migration file
    const migrationSQL = fs.readFileSync('./migrations/0031_add_custom_cards.sql', 'utf8');
    
    console.log('📄 Migration SQL loaded, executing...');
    
    // Execute the entire migration as one statement (it has CREATE TABLE IF NOT EXISTS)
    await sql.unsafe(migrationSQL);

    console.log('✅ Successfully created custom_cards table and indexes');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

