import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function runSingleMigration() {
  try {
    console.log('🔧 Running single migration: 016_add_promotion_id_to_birthday_settings.sql');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./migrations/016_add_promotion_id_to_birthday_settings.sql', 'utf8');
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runSingleMigration();