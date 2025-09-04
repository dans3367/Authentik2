import dotenv from 'dotenv';
import { storage } from '../server/storage.ts';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function testDetailedStats() {
  try {
    console.log('Testing detailed-stats endpoint...');
    
    // Get a user from the database to generate a valid token
    const users = await storage.query('SELECT * FROM users LIMIT 1');
    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    const user = users[0];
    console.log('Found user:', user.email);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        tenantId: user.tenant_id,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Generated JWT token');
    
    // Test the detailed-stats endpoint
    const newsletterId = '04cea272-c163-4f2a-9356-e6ab79fb8f32';
    const response = await fetch(`http://localhost:3504/api/newsletters/${newsletterId}/detailed-stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Detailed-stats response status:', response.status);
    const responseData = await response.json();
    console.log('Detailed-stats response:', JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('Error testing detailed-stats:', error);
  } finally {
    process.exit(0);
  }
}

testDetailedStats();