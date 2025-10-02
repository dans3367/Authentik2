#!/usr/bin/env node

/**
 * Test script to verify newsletter integration between Node.js and Go server
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const GO_SERVER_URL = process.env.GO_SERVER_URL || 'http://localhost:3501';

async function testNewsletterIntegration() {
  console.log('🧪 Testing Newsletter Integration');
  console.log('==================================');
  console.log(`Node.js Server: ${BASE_URL}`);
  console.log(`Go Server: ${GO_SERVER_URL}`);
  console.log('');

  try {
    // Test 1: Check Go server health
    console.log('📡 Test 1: Go Server Health Check');
    try {
      const healthResponse = await fetch(`${GO_SERVER_URL}/health`);
      const healthData = await healthResponse.json();
      console.log('✅ Go server is healthy:', healthData);
    } catch (error) {
      console.log('❌ Go server health check failed:', error.message);
      console.log('   Make sure the Go server is running on port 3501');
    }
    console.log('');

    // Test 2: Check Node.js server health
    console.log('📡 Test 2: Node.js Server Health Check');
    try {
      const nodeHealthResponse = await fetch(`${BASE_URL}/api/health`);
      const nodeHealthData = await nodeHealthResponse.json();
      console.log('✅ Node.js server is healthy:', nodeHealthData);
    } catch (error) {
      console.log('❌ Node.js server health check failed:', error.message);
      console.log('   Make sure the Node.js server is running on port 5000');
    }
    console.log('');

    // Test 3: Check Go server health via Node.js proxy
    console.log('📡 Test 3: Go Server Health via Node.js Proxy');
    try {
      // This would require authentication, so we'll just note it
      console.log('ℹ️  Go server health check via Node.js requires authentication');
      console.log('   Endpoint: GET /api/newsletters/go-server-health');
    } catch (error) {
      console.log('❌ Go server proxy health check failed:', error.message);
    }
    console.log('');

    console.log('🎯 Integration Test Complete!');
    console.log('');
    console.log('To test newsletter sending:');
    console.log('1. Start both servers:');
    console.log('   - Node.js: npm run dev');
    console.log('   - Go: cd server-go && ./start.sh');
    console.log('2. Create a newsletter in the frontend');
    console.log('3. Send the newsletter');
    console.log('4. Check the console logs for Go server communication');
    console.log('5. Verify Temporal workflows are triggered');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testNewsletterIntegration();
}

module.exports = { testNewsletterIntegration };
