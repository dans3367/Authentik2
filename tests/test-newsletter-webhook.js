#!/usr/bin/env node

// Test script to simulate newsletter webhook events from Resend
// This tests the newsletter engagement tracking (opens, clicks) with UUID-based group tracking

const crypto = require('crypto');

// Configuration
const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/resend';
const WEBHOOK_SECRET = 'whsec_dQmHqFcRLvFHgdRvQwBHQXcm8GnvCrF6'; // Matches RESEND_WEBHOOK_SECRET in .env

// Helper function to generate webhook signature
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

// Helper function to send webhook
async function sendWebhook(eventType, email, newsletterId, groupUUID, additionalData = {}) {
  const payload = {
    type: eventType,
    created_at: new Date().toISOString(),
    data: {
      id: `msg_${Math.random().toString(36).substring(7)}`,
      message_id: `msg_${Math.random().toString(36).substring(7)}`,
      to: email,
      from: 'newsletter@example.com',
      subject: `Test Newsletter [Newsletter:${newsletterId}]`,
      tags: [`newsletter-${newsletterId}`, 'newsletter', 'test', `groupUUID-${groupUUID}`],
      ...additionalData
    }
  };

  const signature = generateSignature(payload, WEBHOOK_SECRET);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'resend-signature': signature
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    console.log(`✅ ${eventType} event for ${email}: ${response.status} - ${result}`);
    return { success: true, status: response.status, result };
  } catch (error) {
    console.error(`❌ ${eventType} event failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main test function
async function testNewsletterEngagement() {
  console.log('🚀 Testing Newsletter Webhook Engagement Tracking with GroupUUID\n');
  
  // Get newsletter ID from command line or use a default
  const newsletterId = process.argv[2];
  
  if (!newsletterId) {
    console.error('❌ Please provide a newsletter ID as an argument');
    console.log('Usage: node test-newsletter-webhook.js <newsletter-id>');
    console.log('Example: node test-newsletter-webhook.js d7a2cc8d-2ac5-4fea-b263-e4b67c5b34fe');
    process.exit(1);
  }
  
  // Generate a unique groupUUID for this test batch (simulating real newsletter batch)
  const groupUUID = crypto.randomUUID();
  
  const testEmails = [
    'subscriber1@example.com',
    'subscriber2@example.com',
    'subscriber3@example.com',
    'subscriber4@example.com',
    'subscriber5@example.com'
  ];
  
  console.log(`📧 Testing newsletter: ${newsletterId}`);
  console.log(`🔗 Generated groupUUID: ${groupUUID}`);
  console.log(`📬 Testing with ${testEmails.length} test emails\n`);
  
  // Step 1: Simulate email sent events
  console.log('1️⃣ Simulating email sent events...');
  for (const email of testEmails) {
    await sendWebhook('email.sent', email, newsletterId, groupUUID);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }
  
  console.log('\n2️⃣ Simulating email delivered events...');
  for (const email of testEmails) {
    await sendWebhook('email.delivered', email, newsletterId, groupUUID);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n3️⃣ Simulating email opened events (60% open rate)...');
  const openedEmails = testEmails.slice(0, 3); // 3 out of 5 = 60%
  for (const email of openedEmails) {
    await sendWebhook('email.opened', email, newsletterId, groupUUID, {
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.1'
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n4️⃣ Simulating email clicked events (33% CTR)...');
  const clickedEmails = openedEmails.slice(0, 1); // 1 out of 3 opened = 33%
  for (const email of clickedEmails) {
    await sendWebhook('email.clicked', email, newsletterId, groupUUID, {
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.1',
      url: 'https://example.com/newsletter-link'
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n5️⃣ Simulating bounced email...');
  await sendWebhook('email.bounced', 'bounced@example.com', newsletterId, groupUUID, {
    bounce_type: 'hard'
  });
  
  console.log('\n✨ Test complete!');
  console.log('\n📊 Expected results in newsletter view:');
  console.log('- Recipients: 5');
  console.log('- Opens: 3 (60% open rate)');
  console.log('- Clicks: 1 (33% CTR)');
  console.log(`\n🔗 Newsletter batch tracked with groupUUID: ${groupUUID}`);
  console.log('\n📌 Check your newsletter view page to see updated engagement metrics!');
  console.log('📝 Check server logs for groupUUID tracking confirmation.');
}

// Run the test
testNewsletterEngagement().catch(console.error);