import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTables() {
  try {
    const result = await db.execute(sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    const tables = Array.isArray(result) ? result : result.rows || [];
    console.log('Tables in database:');
    tables.forEach((row: any) => console.log(`  - ${row.tablename}`));
    console.log(`\nTotal: ${tables.length} tables`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTables();

