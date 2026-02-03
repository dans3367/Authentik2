import postgres from 'postgres';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const requiresSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech');

const sql = postgres(databaseUrl, {
  ssl: requiresSSL ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function testGoServerAuth() {
  try {
    console.log('Testing Go server authentication...');
    
    // Get a user from the database to create a valid token
    const users = await sql`SELECT id, email, tenant_id FROM users LIMIT 1`;
    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    const user = users[0];
    console.log('Found user:', user.email);
    
    // Create a valid JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        tenantId: user.tenant_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Generated JWT token');
    
    // Test the Go server endpoint
    const response = await fetch('http://localhost:3501/api/email-tracking', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Go server response status:', response.status);
    const responseText = await response.text();
    console.log('Go server response:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('Email tracking data count:', data.length || 'Not an array');
      } catch (e) {
        console.log('Response is not JSON');
      }
    }
    
  } catch (error) {
    console.error('Error testing Go server:', error.message);
  }
}

testGoServerAuth();