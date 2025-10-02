import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function testBirthdaySettings() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔍 Checking birthday settings and promotions...');

    // Check if there are any promotions
    const promotions = await sql`
      SELECT id, title, content FROM promotions LIMIT 5;
    `;
    console.log('📋 Available promotions:', promotions.length);
    promotions.forEach(p => console.log(`  - ${p.id}: ${p.title}`));

    // Check birthday settings
    const birthdaySettings = await sql`
      SELECT id, tenant_id, promotion_id, enabled FROM birthday_settings LIMIT 5;
    `;
    console.log('🎂 Birthday settings:', birthdaySettings.length);
    birthdaySettings.forEach(bs => console.log(`  - ID: ${bs.id}, Tenant: ${bs.tenant_id}, Promotion: ${bs.promotion_id}, Enabled: ${bs.enabled}`));

    // Try to update birthday settings with a promotion
    if (promotions.length > 0 && birthdaySettings.length > 0) {
      const firstPromotion = promotions[0];
      const firstSettings = birthdaySettings[0];

      console.log(`🔄 Updating birthday settings ${firstSettings.id} to use promotion ${firstPromotion.id}`);

      await sql`
        UPDATE birthday_settings
        SET promotion_id = ${firstPromotion.id}, enabled = true, updated_at = NOW()
        WHERE id = ${firstSettings.id};
      `;

      console.log('✅ Birthday settings updated successfully');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sql.end();
  }
}

testBirthdaySettings();
