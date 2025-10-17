import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Add disabled_holidays to birthday_settings...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_disabled_holidays_to_birthday_settings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
    console.log('📝 Added disabled_holidays column to birthday_settings table');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
