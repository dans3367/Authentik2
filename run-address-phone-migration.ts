import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function runAddressPhoneMigration() {
  try {
    console.log('🔧 Running migration: 030_add_address_phone_to_email_contacts.sql');
    
    const migrationSQL = fs.readFileSync('./migrations/030_add_address_phone_to_email_contacts.sql', 'utf8');
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Added fields: address, city, state, zip_code, country, phone_number');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAddressPhoneMigration();
