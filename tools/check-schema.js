import { db } from './server/db.js';

async function checkSchema() {
  try {
    const result = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'birthday_settings'
      ORDER BY ordinal_position;
    `);
    console.log('Birthday settings table columns:');
    console.log(result.rows);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
