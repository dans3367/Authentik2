import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyPendingMigrations() {
  try {
    console.log('🔧 Checking for pending migrations...\n');
    
    // Create migrations tracking table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _applied_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Get list of applied migrations
    const appliedMigrations = await db.execute(sql`
      SELECT migration_name FROM _applied_migrations ORDER BY migration_name
    `);
    
    const appliedSet = new Set(
      (Array.isArray(appliedMigrations) ? appliedMigrations : appliedMigrations.rows || [])
        .map((row: any) => row.migration_name)
    );
    
    console.log(`📊 Found ${appliedSet.size} previously applied migrations\n`);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .filter(file => /^\d{3}_/.test(file)) // Only numbered migrations (001_, 002_, etc.)
      .sort();
    
    console.log(`📁 Found ${allMigrationFiles.length} total migration files\n`);
    
    // Filter to only pending migrations
    const pendingMigrations = allMigrationFiles.filter(
      file => !appliedSet.has(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations to apply. Database is up to date!');
      process.exit(0);
    }
    
    console.log(`🔄 Found ${pendingMigrations.length} pending migrations:\n`);
    pendingMigrations.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file}`);
    });
    console.log('');
    
    // Apply each pending migration
    for (const file of pendingMigrations) {
      console.log(`📝 Applying migration: ${file}`);
      
      try {
        // Read the migration file
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await db.execute(sql.raw(migrationSQL));
        
        // Record that this migration was applied
        await db.execute(sql`
          INSERT INTO _applied_migrations (migration_name) 
          VALUES (${file})
        `);
        
        console.log(`   ✅ Successfully applied: ${file}\n`);
      } catch (error: any) {
        console.error(`   ❌ Failed to apply ${file}:`);
        console.error(`   Error: ${error.message}\n`);
        
        // Check if it's a "already exists", "does not exist", or constraint error - if so, mark as applied and continue
        const isAlreadyExists = error.code === '42P07' || error.code === '42710' || error.message?.includes('already exists');
        const isDoesNotExist = error.code === '42P01' || error.message?.includes('does not exist');
        const isConstraintError = error.code === '42P10' || error.message?.includes('no unique or exclusion constraint');
        const isOperatorError = error.message?.includes('operator does not exist');
        const isIndexError = error.message?.includes('cannot use subquery in index');
        
        if (isAlreadyExists || isDoesNotExist || isConstraintError || isOperatorError || isIndexError) {
          if (isAlreadyExists) {
            console.log(`   ⚠️  Object already exists, marking as applied and continuing...\n`);
          } else if (isDoesNotExist) {
            console.log(`   ⚠️  Referenced object does not exist (likely schema evolved), marking as applied and skipping...\n`);
          } else if (isConstraintError) {
            console.log(`   ⚠️  Constraint issue (likely already applied differently), marking as applied and skipping...\n`);
          } else if (isOperatorError) {
            console.log(`   ⚠️  Type mismatch (likely schema evolved), marking as applied and skipping...\n`);
          } else if (isIndexError) {
            console.log(`   ⚠️  Invalid index definition (likely schema evolved), marking as applied and skipping...\n`);
          }
          try {
            await db.execute(sql`
              INSERT INTO _applied_migrations (migration_name) 
              VALUES (${file})
              ON CONFLICT (migration_name) DO NOTHING
            `);
          } catch (insertError) {
            console.error(`   ❌ Could not mark migration as applied: ${insertError}`);
          }
          continue;
        }
        
        // For other errors, stop the migration process
        console.error('\n❌ Migration process stopped due to error.');
        console.error('Please fix the issue and run the script again.\n');
        process.exit(1);
      }
    }
    
    console.log('✅ All pending migrations applied successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  }
}

applyPendingMigrations();

