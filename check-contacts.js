import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { logger: false });

async function checkEmailContacts() {
  try {
    console.log('Checking email contacts in database...');
    
    // Count total contacts
    const result = await sql`SELECT COUNT(*) as count FROM email_contacts`;
    console.log('Total email contacts:', result[0].count);
    
    // Get sample contacts
    const contacts = await sql`SELECT id, email, first_name, last_name, status FROM email_contacts LIMIT 5`;
    console.log('Sample contacts:', contacts);
    
    // Check if any newsletters exist
    const newsletters = await sql`SELECT id, title, recipient_type FROM newsletters LIMIT 5`;
    console.log('Sample newsletters:', newsletters);
    
  } catch (error) {
    console.error('Error checking contacts:', error);
  }
}

checkEmailContacts();