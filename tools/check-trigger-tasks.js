import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function checkTable() {
  const sql = postgres(DATABASE_URL);

  try {
    // Check columns
    const columns = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'trigger_tasks'
      ORDER BY ordinal_position;
    `;
    console.log('Columns:', columns.map(c => c.column_name));

    // Check constraints
    const constraints = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'trigger_tasks';
    `;
    console.log('Constraints:', constraints.map(c => c.constraint_name));

    // Check distinct status values
    const statuses = await sql`
      SELECT DISTINCT status FROM trigger_tasks;
    `;
    console.log('Status values:', statuses.map(s => s.status));

    // Check row count
    const count = await sql`SELECT COUNT(*) as cnt FROM trigger_tasks;`;
    console.log('Row count:', count[0].cnt);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkTable();
