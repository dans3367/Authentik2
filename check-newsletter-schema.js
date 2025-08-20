import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkNewsletterSchema() {
  try {
    console.log('Checking newsletter table structure...');
    
    // Get newsletter table columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'newsletters' 
      ORDER BY ordinal_position
    `;
    console.log('Newsletter table columns:', columns);
    
    // Check newsletter data with available columns
    const newsletters = await sql`
      SELECT id, title, status, created_at
      FROM newsletters 
      ORDER BY created_at DESC 
      LIMIT 3
    `;
    console.log('Recent newsletters:', newsletters);
    
    // Check email activities with newsletter_id
    const activitiesWithNewsletter = await sql`
      SELECT COUNT(*) as count 
      FROM email_activity 
      WHERE newsletter_id IS NOT NULL
    `;
    console.log('Activities with newsletter_id:', activitiesWithNewsletter[0].count);
    
    // Check if there are activities for a specific newsletter
    if (newsletters.length > 0) {
      const newsletterId = newsletters[0].id;
      const specificActivities = await sql`
        SELECT COUNT(*) as count 
        FROM email_activity 
        WHERE newsletter_id = ${newsletterId}
      `;
      console.log(`Activities for newsletter ${newsletterId}:`, specificActivities[0].count);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkNewsletterSchema();