import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function runMigration() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔧 Running migration to rename inngest_events to trigger_tasks...');

    // Check if trigger_tasks already exists (migration already run)
    const existingTable = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'trigger_tasks';
    `;

    if (existingTable.length > 0) {
      console.log('✅ trigger_tasks table already exists - migration may have been run');
      
      // Check if we need to add new columns
      const existingColumns = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'trigger_tasks';
      `;
      const columnNames = existingColumns.map(c => c.column_name);
      
      if (!columnNames.includes('error_code')) {
        console.log('Adding error_code column...');
        await sql.unsafe(`ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS error_code TEXT;`);
      }
      if (!columnNames.includes('started_at')) {
        console.log('Adding started_at column...');
        await sql.unsafe(`ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;`);
      }
      
      console.log('✅ Migration complete');
      return;
    }

    // Check if inngest_events exists
    const inngestTable = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'inngest_events';
    `;

    if (inngestTable.length === 0) {
      console.log('⚠️ Neither inngest_events nor trigger_tasks exists. Creating trigger_tasks from scratch...');
      
      await sql.unsafe(`
        CREATE TABLE trigger_tasks (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL,
          run_id TEXT,
          idempotency_key TEXT UNIQUE,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempt_count INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          last_attempt_at TIMESTAMP,
          scheduled_for TIMESTAMP,
          output TEXT,
          error_message TEXT,
          error_code TEXT,
          related_type TEXT,
          related_id VARCHAR,
          triggered_at TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create indexes
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_tenant_id ON trigger_tasks(tenant_id);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_task_id ON trigger_tasks(task_id);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_run_id ON trigger_tasks(run_id);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_status ON trigger_tasks(status);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_idempotency_key ON trigger_tasks(idempotency_key);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_scheduled_for ON trigger_tasks(scheduled_for);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_related ON trigger_tasks(related_type, related_id);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_created_at ON trigger_tasks(created_at);`);
      await sql.unsafe(`CREATE INDEX idx_trigger_tasks_active ON trigger_tasks(status) WHERE status IN ('pending', 'triggered', 'running');`);

      // Add constraint
      await sql.unsafe(`
        ALTER TABLE trigger_tasks ADD CONSTRAINT check_trigger_task_status 
        CHECK (status IN ('pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'));
      `);

      // Create trigger function
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION update_trigger_tasks_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await sql.unsafe(`
        CREATE TRIGGER update_trigger_tasks_updated_at
            BEFORE UPDATE ON trigger_tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_trigger_tasks_updated_at();
      `);

      console.log('✅ Created trigger_tasks table from scratch');
      return;
    }

    // Rename inngest_events to trigger_tasks
    console.log('Renaming inngest_events to trigger_tasks...');
    await sql.unsafe(`ALTER TABLE inngest_events RENAME TO trigger_tasks;`);

    // Rename columns
    console.log('Renaming columns...');
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN event_name TO task_id;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN event_id TO run_id;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN event_data TO payload;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN retry_count TO attempt_count;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN max_retries TO max_attempts;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN last_retry_at TO last_attempt_at;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN result TO output;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks RENAME COLUMN sent_at TO triggered_at;`);

    // Add new columns
    console.log('Adding new columns...');
    await sql.unsafe(`ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS error_code TEXT;`);
    await sql.unsafe(`ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;`);

    // Drop old column
    await sql.unsafe(`ALTER TABLE trigger_tasks DROP COLUMN IF EXISTS next_retry_at;`);

    // Update existing status values to match new constraint
    console.log('Updating existing status values...');
    await sql.unsafe(`UPDATE trigger_tasks SET status = 'triggered' WHERE status = 'sent';`);
    await sql.unsafe(`UPDATE trigger_tasks SET status = 'running' WHERE status = 'processing';`);

    // Update constraints
    console.log('Updating constraints...');
    await sql.unsafe(`ALTER TABLE trigger_tasks DROP CONSTRAINT IF EXISTS check_inngest_event_status;`);
    await sql.unsafe(`
      ALTER TABLE trigger_tasks ADD CONSTRAINT check_trigger_task_status 
      CHECK (status IN ('pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'));
    `);

    // Rename indexes
    console.log('Renaming indexes...');
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_tenant_id RENAME TO idx_trigger_tasks_tenant_id;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_event_name RENAME TO idx_trigger_tasks_task_id;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_event_id RENAME TO idx_trigger_tasks_run_id;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_status RENAME TO idx_trigger_tasks_status;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_idempotency_key RENAME TO idx_trigger_tasks_idempotency_key;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_scheduled_for RENAME TO idx_trigger_tasks_scheduled_for;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_related RENAME TO idx_trigger_tasks_related;`);
    await sql.unsafe(`ALTER INDEX IF EXISTS idx_inngest_events_created_at RENAME TO idx_trigger_tasks_created_at;`);

    // Drop and recreate partial index
    await sql.unsafe(`DROP INDEX IF EXISTS idx_inngest_events_pending;`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_trigger_tasks_active ON trigger_tasks(status) WHERE status IN ('pending', 'triggered', 'running');`);

    // Update trigger function
    console.log('Updating trigger function...');
    await sql.unsafe(`DROP TRIGGER IF EXISTS update_inngest_events_updated_at ON trigger_tasks;`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS update_inngest_events_updated_at();`);

    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION update_trigger_tasks_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await sql.unsafe(`
      CREATE TRIGGER update_trigger_tasks_updated_at
          BEFORE UPDATE ON trigger_tasks
          FOR EACH ROW
          EXECUTE FUNCTION update_trigger_tasks_updated_at();
    `);

    console.log('✅ Successfully renamed inngest_events to trigger_tasks');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

runMigration();
