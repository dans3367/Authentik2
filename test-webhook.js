#!/usr/bin/env node

// Test script to simulate webhook data for email activity tracking

const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/resend';

// Sample webhook payloads for different email events
const webhookPayloads = [
  {
    type: 'email.sent',
    data: {
      email: 'dan@zendwise.com',
      message_id: 'msg_123_sent',
      subject: 'Welcome to our newsletter!',
      tags: ['newsletter', 'welcome'],
      created_at: new Date().toISOString()
    }
  },
  {
    type: 'email.delivered',
    data: {
      email: 'dan@zendwise.com', 
      message_id: 'msg_123_delivered',
      subject: 'Welcome to our newsletter!',
      tags: ['newsletter', 'welcome'],
      created_at: new Date(Date.now() + 1000).toISOString()
    }
  },
  {
    type: 'email.opened',
    data: {
      email: 'dan@zendwise.com',
      message_id: 'msg_123_opened',
      subject: 'Welcome to our newsletter!',
      tags: ['newsletter', 'welcome'],
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ip: '192.168.1.100',
      created_at: new Date(Date.now() + 5000).toISOString()
    }
  },
  {
    type: 'email.clicked',
    data: {
      email: 'dan@zendwise.com',
      message_id: 'msg_123_clicked',
      subject: 'Welcome to our newsletter!',
      tags: ['newsletter', 'welcome'],
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ip: '192.168.1.100',
      created_at: new Date(Date.now() + 10000).toISOString()
    }
  }
];

async function sendWebhook(payload) {
  try {
    console.log(`Sending ${payload.type} webhook...`);
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`Response (${response.status}):`, result);
    console.log('---');
  } catch (error) {
    console.error(`Error sending ${payload.type} webhook:`, error.message);
  }
}

async function runTest() {
  console.log('🔄 Testing email activity webhooks...\n');
  
  for (const payload of webhookPayloads) {
    await sendWebhook(payload);
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Webhook test completed!');
  console.log('\n📋 You can now check the contact view page to see the activity timeline.');
}

// Run the test if this script is executed directly
if (require.main === module) {
  runTest();
}

module.exports = { runTest, sendWebhook, webhookPayloads };