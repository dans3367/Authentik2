import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SERVER_URL = 'http://127.0.0.1:3504';
const NEWSLETTER_ID = '04cea272-c163-4f2a-9356-e6ab79fb8f32';

// User data from database
const testUser = {
  id: 'f5a5670b-c33e-4a64-be68-2e50c83afce9',
  email: 'beats@zendwise.work',
  tenant_id: 'c3fe612e-8a42-45de-a98e-a0b29be414df'
};

async function testDetailedStats() {
  try {
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        tenantId: testUser.tenant_id
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('Generated JWT token for user:', testUser.email);
    console.log('Testing detailed stats endpoint...');

    // Test the detailed stats endpoint
    const response = await fetch(
      `${SERVER_URL}/api/newsletters/${NEWSLETTER_ID}/detailed-stats`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const data = await response.text();
    console.log('Response body:', data);

    if (response.ok) {
      try {
        const jsonData = JSON.parse(data);
        console.log('\nParsed JSON response:');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('Response is not valid JSON');
      }
    } else {
      console.log('Request failed with status:', response.status);
    }

  } catch (error) {
    console.error('Error testing detailed stats:', error);
  }
}

testDetailedStats();