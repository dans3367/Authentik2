#!/usr/bin/env node

// Simple test to verify webhook functionality
async function testWebhook() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3505';

  console.log('🧪 Testing webhook functionality for dan@zendwise.com\n');
  console.log('📍 Server URL:', baseURL);

  // Simple test data for dan@zendwise.com
  const testData = {
    email: 'dan@zendwise.com',
    eventType: 'opened',
    newsletterId: 'test-newsletter-123',
    campaignId: 'test-campaign-456'
  };

  try {
    console.log('📤 Sending test webhook request...');

    // Using fetch instead of axios for simplicity
    const response = await fetch(`${baseURL}/api/webhooks/test/webhook-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need a valid auth token
        // 'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', result.message);
      console.log('📧 Email:', testData.email);
      console.log('📊 Event Type:', testData.eventType);
    } else {
      const error = await response.text();
      console.error('❌ Error:', response.status, error);
    }

  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('\n💡 Make sure the server is running:');
    console.log('   npm run dev');
    console.log('   or');
    console.log('   PORT=5000 npm run dev');
  }

  console.log('\n📋 What we implemented:');
  console.log('✅ Extract recipient email from webhook data');
  console.log('✅ Find corresponding contact in database');
  console.log('✅ Update contact activity metrics (emailsSent, emailsOpened, lastActivity)');
  console.log('✅ Create email activity records for tracking');
  console.log('✅ Support both Resend and Postmark webhook formats');

  console.log('\n🔍 To verify the implementation:');
  console.log('1. Start your server: npm run dev');
  console.log('2. Run this test: node test-webhook.js');
  console.log('3. Check database for updated dan@zendwise.com metrics');
  console.log('4. Verify email_activity table has new records');
  console.log('5. Test with real webhook data from your email provider');
}

// Run the test
testWebhook().catch(console.error);
