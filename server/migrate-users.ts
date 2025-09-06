import { db } from './db';
import { betterAuthUser } from '@shared/schema';

async function fixForeignKeys() {
  console.log('🔧 Fixing foreign key references after users table removal...');

  try {
    // Known user ID mapping (old user ID -> new better_auth_user ID)
    const userIdMapping = {
      '83aaa4dd-6ad5-4c8d-a0fb-c0714bd02f62': 'SYsPH1iAW5mktT8lXShHhBXXR3gXfhGA' // owner@example.com
    };

    console.log('🔄 User ID mapping:', userIdMapping);

    // Fix foreign keys in related tables
    const tablesToFix = [
      { name: 'forms', column: 'user_id' },
      { name: 'refresh_tokens', column: 'user_id' },
      { name: 'campaigns', column: 'user_id' },
      { name: 'newsletters', column: 'user_id' },
      { name: 'companies', column: 'owner_id' }
    ];

    for (const table of tablesToFix) {
      console.log(`🔧 Fixing foreign keys in ${table.name} table...`);

      // Get records that have user references to the old user ID
      const result = await db.execute(`
        SELECT id, ${table.column} FROM ${table.name} WHERE ${table.column} = '83aaa4dd-6ad5-4c8d-a0fb-c0714bd02f62'
      `);

      if (result.rows.length > 0) {
        console.log(`📊 Found ${result.rows.length} records in ${table.name} to update`);

        for (const record of result.rows) {
          // Update the foreign key to point to the new user ID
          await db.execute(`
            UPDATE ${table.name}
            SET ${table.column} = '${userIdMapping[record[table.column]]}'
            WHERE id = '${record.id}'
          `);
          console.log(`✅ Updated ${table.name} record ${record.id}`);
        }
      }
    }

    console.log('🎉 Foreign key migration completed successfully!');

  } catch (error) {
    console.error('❌ Foreign key fix failed:', error);
    process.exit(1);
  }
}

fixForeignKeys();
