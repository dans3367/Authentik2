/**
 * Migration script to mark existing companies as onboarding complete
 * This prevents existing companies from seeing the onboarding wizard
 * 
 * Run this with: tsx server/mark-existing-companies-complete.ts
 */

import { db } from './db';
import { companies } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function markExistingCompaniesComplete() {
  console.log('🚀 Starting migration: Mark existing companies as onboarding complete');
  
  try {
    // Update all existing companies that don't have setupCompleted set
    const result = await db.update(companies)
      .set({
        setupCompleted: true,
        updatedAt: new Date(),
      })
      .where(sql`${companies.setupCompleted} IS NULL OR ${companies.setupCompleted} = false`)
      .returning({ id: companies.id, name: companies.name });

    console.log(`✅ Successfully updated ${result.length} companies:`);
    result.forEach(company => {
      console.log(`   - ${company.name} (${company.id})`);
    });

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
markExistingCompaniesComplete();
