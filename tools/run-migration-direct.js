import postgres from 'postgres';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function runMigration() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔧 Running migration to add promotion_id column...');

    // Check if column already exists
    const existingColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'birthday_settings' AND column_name = 'promotion_id';
    `;

    if (existingColumns.length > 0) {
      console.log('✅ promotion_id column already exists in birthday_settings table');
      return;
    }

    // Run the migration
    await sql.unsafe(`
      ALTER TABLE birthday_settings
      ADD COLUMN promotion_id VARCHAR REFERENCES promotions(id) ON DELETE SET NULL;
    `);

    await sql.unsafe(`
      COMMENT ON COLUMN birthday_settings.promotion_id IS 'Optional promotion to include in birthday emails';
    `);

    await sql.unsafe(`
      CREATE INDEX idx_birthday_settings_promotion_id ON birthday_settings(promotion_id);
    `);

    console.log('✅ Successfully added promotion_id column to birthday_settings table');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

runMigration();
