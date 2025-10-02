import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function checkAllBirthdaySettings() {
  const sql = postgres(DATABASE_URL);

  try {
    const settings = await sql`
      SELECT bs.id, bs.tenant_id, bs.promotion_id, bs.enabled, p.title as promotion_title, p.content as promotion_content
      FROM birthday_settings bs
      LEFT JOIN promotions p ON bs.promotion_id = p.id
      ORDER BY bs.created_at DESC;
    `;

    console.log('🎂 All birthday settings:');
    settings.forEach(s => {
      console.log(`  Tenant: ${s.tenant_id}`);
      console.log(`  Promotion: ${s.promotion_title || 'None'}`);
      console.log(`  Content length: ${s.promotion_content?.length || 0}`);
      console.log(`  Enabled: ${s.enabled}`);
      console.log('---');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkAllBirthdaySettings();
