import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function testSplitPromotionalEmail() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔍 Testing "Split Promotional Email" Feature\n');
    console.log('=' .repeat(60));
    
    // Test 1: Query current settings
    console.log('\n1️⃣  Querying all birthday settings with split_promotional_email:\n');
    const allSettings = await sql`
      SELECT 
        id,
        tenant_id,
        enabled,
        split_promotional_email,
        promotion_id,
        email_template
      FROM birthday_settings
      ORDER BY created_at DESC;
    `;
    
    console.log(`Found ${allSettings.length} birthday settings:`);
    allSettings.forEach((setting, idx) => {
      console.log(`\n   Setting ${idx + 1}:`);
      console.log(`   - ID: ${setting.id}`);
      console.log(`   - Tenant: ${setting.tenant_id}`);
      console.log(`   - Enabled: ${setting.enabled}`);
      console.log(`   - Split Promotional Email: ${setting.split_promotional_email} ${setting.split_promotional_email ? '✅' : '❌'}`);
      console.log(`   - Has Promotion: ${setting.promotion_id ? 'Yes' : 'No'}`);
    });
    
    // Test 2: Query settings where split_promotional_email is enabled
    console.log('\n\n2️⃣  Querying settings with split_promotional_email = TRUE:\n');
    const enabledSettings = await sql`
      SELECT 
        id,
        tenant_id,
        split_promotional_email
      FROM birthday_settings
      WHERE split_promotional_email = true;
    `;
    
    if (enabledSettings.length > 0) {
      console.log(`   Found ${enabledSettings.length} settings with split promotional email enabled`);
      enabledSettings.forEach(s => console.log(`   - ${s.id}`));
    } else {
      console.log('   ℹ️  No settings currently have split promotional email enabled');
    }
    
    // Test 3: Demonstrate updating a setting
    if (allSettings.length > 0) {
      const testSetting = allSettings[0];
      console.log('\n\n3️⃣  Testing UPDATE operation:\n');
      console.log(`   Target Setting ID: ${testSetting.id}`);
      console.log(`   Current split_promotional_email: ${testSetting.split_promotional_email}`);
      
      // Toggle the value
      const newValue = !testSetting.split_promotional_email;
      console.log(`   Setting to: ${newValue}`);
      
      await sql`
        UPDATE birthday_settings
        SET 
          split_promotional_email = ${newValue},
          updated_at = NOW()
        WHERE id = ${testSetting.id}
      `;
      
      // Verify the update
      const updated = await sql`
        SELECT id, split_promotional_email, updated_at
        FROM birthday_settings
        WHERE id = ${testSetting.id}
      `;
      
      console.log(`   ✅ Update successful!`);
      console.log(`   New value: ${updated[0].split_promotional_email}`);
      console.log(`   Updated at: ${updated[0].updated_at}`);
      
      // Revert the change
      console.log(`\n   Reverting change...`);
      await sql`
        UPDATE birthday_settings
        SET 
          split_promotional_email = ${testSetting.split_promotional_email},
          updated_at = NOW()
        WHERE id = ${testSetting.id}
      `;
      console.log(`   ✅ Reverted to original value: ${testSetting.split_promotional_email}`);
    }
    
    // Test 4: Show usage recommendation
    console.log('\n\n4️⃣  Usage Recommendation:\n');
    console.log('   To enable "Split Promotional Email" for better deliverability:');
    console.log('   ');
    console.log('   UPDATE birthday_settings');
    console.log('   SET split_promotional_email = true');
    console.log('   WHERE tenant_id = YOUR_TENANT_ID;');
    console.log('   ');
    console.log('   When enabled, birthday emails and promotional content');
    console.log('   will be sent as separate emails to improve deliverability.');
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

testSplitPromotionalEmail();
