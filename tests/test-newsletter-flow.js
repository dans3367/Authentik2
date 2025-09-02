#!/usr/bin/env node

const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = 'Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag==';
const API_BASE = 'http://localhost:4000/api';
const GO_SERVER = 'https://tenginew.zendwise.work';
const API_BASE = 'http://localhost:3504/api';
const GO_SERVER = 'https://tenginex.zendwise.work';

// Test user credentials - you'll need to update these with actual user data
const TEST_USER = {
  email: 'dan@zendwise.com',
  password: 'password123'
};

async function testNewsletterFlow() {
  console.log('🚀 Testing Newsletter Flow\n');
  
  try {
    // Step 1: Login to get auth token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', await loginResponse.text());
      console.log('\n📝 Note: You need to have a valid user account.');
      console.log('   Create one via the UI at http://localhost:3504/register');
      return;
    }
    
    const loginData = await loginResponse.json();
    const authToken = loginData.accessToken;
    console.log('✅ Login successful');
    
    // Step 2: Check for email contacts
    console.log('\n2️⃣ Checking email contacts...');
    const contactsResponse = await fetch(`${API_BASE}/email-contacts`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const contactsData = await contactsResponse.json();
    console.log(`📧 Found ${contactsData.contacts?.length || 0} email contacts`);
    
    if (!contactsData.contacts || contactsData.contacts.length === 0) {
      console.log('❌ No email contacts found!');
      console.log('📝 Creating a test contact...');
      
      const createContactResponse = await fetch(`${API_BASE}/email-contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'newsletter@example.com',
          firstName: 'Test',
          lastName: 'Contact',
          status: 'active',
          consentGiven: true
        })
      });
      
      if (createContactResponse.ok) {
        console.log('✅ Test contact created');
      } else {
        console.log('❌ Failed to create contact:', await createContactResponse.text());
      }
    }
    
    // Step 3: Create a newsletter
    console.log('\n3️⃣ Creating newsletter...');
    const newsletterResponse = await fetch(`${API_BASE}/newsletters`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Newsletter',
        subject: 'Test Newsletter Subject',
        content: '<h1>Hello!</h1><p>This is a test newsletter.</p>',
        status: 'draft',
        recipientType: 'all'
      })
    });
    
    if (!newsletterResponse.ok) {
      console.log('❌ Newsletter creation failed:', await newsletterResponse.text());
      return;
    }
    
    const newsletterData = await newsletterResponse.json();
    const newsletterId = newsletterData.newsletter.id;
    console.log('✅ Newsletter created:', newsletterId);
    
    // Step 4: Check Go server health
    console.log('\n4️⃣ Checking Go server health...');
    const healthResponse = await fetch(`${GO_SERVER}/health`);
    const healthData = await healthResponse.json();
    console.log('🔸 Go server status:', healthData.status);
    console.log('🔸 Temporal status:', healthData.temporal);
    
    // Step 5: Send the newsletter
    console.log('\n5️⃣ Sending newsletter...');
    const sendResponse = await fetch(`${API_BASE}/newsletters/${newsletterId}/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!sendResponse.ok) {
      console.log('❌ Newsletter send failed:', await sendResponse.text());
      return;
    }
    
    const sendData = await sendResponse.json();
    console.log('✅ Newsletter send initiated');
    console.log('📊 Results:', {
      totalRecipients: sendData.totalRecipients,
      successful: sendData.successful,
      failed: sendData.failed
    });
    
    // Step 6: Check email tracking
    console.log('\n6️⃣ Checking email tracking...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const trackingResponse = await fetch(`${GO_SERVER}/api/email-tracking`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (trackingResponse.ok) {
      const trackingData = await trackingResponse.json();
      console.log(`📬 Email tracking entries: ${trackingData.count}`);
      
      if (trackingData.entries && trackingData.entries.length > 0) {
        const latestEntry = trackingData.entries[0];
        console.log('🔸 Latest email status:', latestEntry.status);
        console.log('🔸 Workflow status:', latestEntry.metadata?.workflowStatus);
        console.log('🔸 Resend ID:', latestEntry.metadata?.resendId);
      }
    }
    
    console.log('\n✅ Newsletter flow test completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
  console.log('Installing node-fetch...');
  const { execSync } = require('child_process');
  execSync('npm install node-fetch@2', { stdio: 'inherit' });
  global.fetch = require('node-fetch');
}

testNewsletterFlow();

