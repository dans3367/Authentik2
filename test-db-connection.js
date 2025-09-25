// Test database connection and promotion query
import { db } from './server-node/src/db.js';
import { eq } from 'drizzle-orm';
import { promotions } from './shared/schema.js';

async function testDB() {
  try {
    console.log('Testing database connection...');

    const allPromotions = await db.select().from(promotions).limit(5);
    console.log('Promotions found:', allPromotions.length);

    if (allPromotions.length > 0) {
      const firstPromotion = allPromotions[0];
      console.log('First promotion:', {
        id: firstPromotion.id,
        title: firstPromotion.title,
        contentLength: firstPromotion.content?.length
      });

      // Test specific promotion query
      const specificPromotion = await db.select().from(promotions).where(eq(promotions.id, '099475b0-fede-474a-bfd6-ac73d129565e')).limit(1);
      console.log('Specific promotion query result:', specificPromotion.length > 0 ? 'Found' : 'Not found');
      if (specificPromotion.length > 0) {
        console.log('Promotion content preview:', specificPromotion[0].content?.substring(0, 50));
      }
    }

  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDB();
