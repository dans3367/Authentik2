import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkApplied() {
  try {
    const result = await db.execute(sql`
      SELECT migration_name, applied_at 
      FROM _applied_migrations 
      ORDER BY migration_name
    `);
    
    const migrations = Array.isArray(result) ? result : result.rows || [];
    console.log('Applied migrations:');
    migrations.forEach((row: any) => console.log(`  - ${row.migration_name} (${row.applied_at})`));
    console.log(`\nTotal: ${migrations.length} applied`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkApplied();

