import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkArchiveField() {
  try {
    // Check if is_archived column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      AND column_name = 'is_archived'
    `);
    
    console.log('Archive field check result:', result);
    
    if (result.length === 0) {
      console.log('❌ is_archived field does not exist, applying migration...');
      
      // Apply the archive fields migration
      await db.execute(sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_appointments_is_archived ON appointments(is_archived)`);
      
      console.log('✅ Archive fields added successfully');
    } else {
      console.log('✅ is_archived field already exists');
    }
    
    // Check current appointments and their archive status
    const appointments = await db.execute(sql`
      SELECT id, title, is_archived, archived_at 
      FROM appointments 
      LIMIT 5
    `);
    
    console.log('Sample appointments:', appointments);
    
  } catch (error) {
    console.error('Error checking archive field:', error);
  }
  
  process.exit(0);
}

checkArchiveField();
