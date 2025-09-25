import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Bulls2398@100.96.48.14/neon';

async function checkPromotionContent() {
  const sql = postgres(DATABASE_URL);

  try {
    const promotions = await sql`
      SELECT id, title, content
      FROM promotions
      WHERE id = '099475b0-fede-474a-bfd6-ac73d129565e';
    `;

    if (promotions.length > 0) {
      console.log('📋 Promotion found:');
      console.log('Title:', promotions[0].title);
      console.log('Content length:', promotions[0].content?.length || 0);
      console.log('Content preview:', promotions[0].content?.substring(0, 200) + '...');
    } else {
      console.log('❌ No promotion found with that ID');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkPromotionContent();
