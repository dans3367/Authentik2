import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function completeMigration() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔧 Completing trigger_tasks migration...');

    // Update existing status values to match new constraint
    console.log('Updating existing status values...');
    const updated = await sql`UPDATE trigger_tasks SET status = 'triggered' WHERE status = 'sent' RETURNING id;`;
    console.log(`Updated ${updated.length} rows from 'sent' to 'triggered'`);
    
    const updated2 = await sql`UPDATE trigger_tasks SET status = 'running' WHERE status = 'processing' RETURNING id;`;
    console.log(`Updated ${updated2.length} rows from 'processing' to 'running'`);

    // Add constraint (if not exists)
    console.log('Adding status constraint...');
    const existingConstraint = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'trigger_tasks' AND constraint_name = 'check_trigger_task_status';
    `;
    if (existingConstraint.length === 0) {
      await sql.unsafe(`
        ALTER TABLE trigger_tasks ADD CONSTRAINT check_trigger_task_status 
        CHECK (status IN ('pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'));
      `);
    } else {
      console.log('Constraint already exists, skipping...');
    }

    // Rename old constraints
    console.log('Renaming constraints...');
    try {
      await sql.unsafe(`ALTER TABLE trigger_tasks RENAME CONSTRAINT inngest_events_pkey TO trigger_tasks_pkey;`);
    } catch (e) { console.log('pkey already renamed or does not exist'); }
    
    try {
      await sql.unsafe(`ALTER TABLE trigger_tasks RENAME CONSTRAINT inngest_events_idempotency_key_unique TO trigger_tasks_idempotency_key_unique;`);
    } catch (e) { console.log('idempotency_key constraint already renamed or does not exist'); }
    
    try {
      await sql.unsafe(`ALTER TABLE trigger_tasks RENAME CONSTRAINT inngest_events_tenant_id_tenants_id_fk TO trigger_tasks_tenant_id_tenants_id_fk;`);
    } catch (e) { console.log('tenant_id fk already renamed or does not exist'); }

    // Create/update trigger function
    console.log('Creating trigger function...');
    await sql.unsafe(`DROP TRIGGER IF EXISTS update_inngest_events_updated_at ON trigger_tasks;`);
    await sql.unsafe(`DROP TRIGGER IF EXISTS update_inngest_events_updated_at ON inngest_events;`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS update_inngest_events_updated_at() CASCADE;`);

    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION update_trigger_tasks_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await sql.unsafe(`DROP TRIGGER IF EXISTS update_trigger_tasks_updated_at ON trigger_tasks;`);
    await sql.unsafe(`
      CREATE TRIGGER update_trigger_tasks_updated_at
          BEFORE UPDATE ON trigger_tasks
          FOR EACH ROW
          EXECUTE FUNCTION update_trigger_tasks_updated_at();
    `);

    // Update comments
    await sql.unsafe(`COMMENT ON TABLE trigger_tasks IS 'Tracks all Trigger.dev background tasks for local status tracking and recovery';`);

    console.log('✅ Migration completed successfully!');

    // Verify
    const statuses = await sql`SELECT DISTINCT status FROM trigger_tasks;`;
    console.log('Final status values:', statuses.map(s => s.status));

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

completeMigration();
