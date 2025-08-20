import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkEmailActivities() {
  try {
    console.log('Checking email activities in database...');
    
    // Check email_activity table
    const activities = await sql`SELECT COUNT(*) as count FROM email_activity`;
    console.log('Total email activities:', activities[0].count);
    
    if (activities[0].count > 0) {
      const sampleActivities = await sql`
        SELECT id, contact_id, newsletter_id, activity_type, created_at 
        FROM email_activity 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      console.log('Sample activities:', sampleActivities);
    }
    
    // Check newsletter stats
    const newsletterStats = await sql`
      SELECT id, title, open_count, click_count, bounce_count, complaint_count, status
      FROM newsletters 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    console.log('Newsletter stats:', newsletterStats);
    
    // Check if there are any webhook logs or events
    try {
      const webhookEvents = await sql`SELECT COUNT(*) as count FROM email_events`;
      console.log('Total webhook events:', webhookEvents[0].count);
      
      if (webhookEvents[0].count > 0) {
        const sampleEvents = await sql`
          SELECT id, event_type, email, created_at 
          FROM email_events 
          ORDER BY created_at DESC 
          LIMIT 5
        `;
        console.log('Sample webhook events:', sampleEvents);
      }
    } catch (e) {
      console.log('email_events table might not exist:', e.message);
    }
    
  } catch (error) {
    console.error('Error checking activities:', error);
  }
}

checkEmailActivities();