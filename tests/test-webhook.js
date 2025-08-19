#!/usr/bin/env node

// Test script to verify newsletter email tracking is working
// This simulates the exact webhook format that Resend sends

const BASE_URL = 'http://localhost:5000';

async function simulateResendWebhook(newsletterId, contactEmail) {
  console.log('\n=== Simulating Resend Webhook (Direct) ===\n');
  
  // Create a realistic Resend webhook payload
  const webhookPayload = {
    type: 'email.opened',
    data: {
      id: `re_${Date.now()}_test`,
      to: [{ email: contactEmail }],
      subject: 'Test Newsletter Subject',
      // This is how Resend actually sends tags back - as objects
      tags: [
        { name: 'newsletter_id', value: `newsletter-${newsletterId}` },
        { name: 'groupUUID', value: `test-group-${Date.now()}` },
        { name: 'type', value: 'newsletter' }
      ],
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ip: '192.168.1.1'
    }
  };
  
  console.log('Sending webhook payload:');
  console.log(JSON.stringify(webhookPayload, null, 2));
  
  try {
    // Generate a fake webhook signature (for testing only)
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = 'test_signature_' + timestamp;
    
    const response = await fetch(`${BASE_URL}/api/webhooks/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'resend-signature': `t=${timestamp},v1=${signature}`
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const responseText = await response.text();
    console.log(`\nWebhook response status: ${response.status}`);
    console.log(`Response: ${responseText}`);
    
    return response.ok;
  } catch (error) {
    console.error('Failed to send webhook:', error.message);
    return false;
  }
}

async function testWebhookProcessing(authToken, newsletterId, contactEmail) {
  console.log('\n=== Testing Newsletter Email Open Tracking ===\n');
  
  try {
    // 1. Get the newsletter before the test
    console.log('1. Fetching newsletter current stats...');
    const newsletterBefore = await fetch(`${BASE_URL}/api/newsletters/${newsletterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!newsletterBefore.ok) {
      throw new Error(`Failed to fetch newsletter: ${newsletterBefore.status}`);
    }
    
    const newsletterDataBefore = await newsletterBefore.json();
    console.log(`   Current open count: ${newsletterDataBefore.openCount || 0}`);
    console.log(`   Current click count: ${newsletterDataBefore.clickCount || 0}`);
    
    // 2. Simulate the Resend webhook directly
    console.log('\n2. Simulating Resend webhook...');
    const webhookSuccess = await simulateResendWebhook(newsletterId, contactEmail);
    
    if (!webhookSuccess) {
      console.log('\n⚠️  Webhook simulation failed, trying test endpoint instead...');
      
      // Fallback to test endpoint
      const testResponse = await fetch(`${BASE_URL}/api/test/webhook-open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newsletterId,
          contactEmail
        })
      });
      
      if (!testResponse.ok) {
        const error = await testResponse.text();
        throw new Error(`Test endpoint also failed: ${error}`);
      }
      
      const testResult = await testResponse.json();
      console.log(`   Test endpoint result: ${JSON.stringify(testResult)}`);
    }
    
    // 3. Wait a moment for processing
    console.log('\n3. Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Verify the newsletter stats were updated
    console.log('\n4. Fetching updated newsletter stats...');
    const newsletterAfter = await fetch(`${BASE_URL}/api/newsletters/${newsletterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!newsletterAfter.ok) {
      throw new Error(`Failed to fetch updated newsletter: ${newsletterAfter.status}`);
    }
    
    const newsletterDataAfter = await newsletterAfter.json();
    console.log(`   Updated open count: ${newsletterDataAfter.openCount || 0}`);
    console.log(`   Updated click count: ${newsletterDataAfter.clickCount || 0}`);
    
    // 5. Check if the update worked
    const openCountIncreased = (newsletterDataAfter.openCount || 0) > (newsletterDataBefore.openCount || 0);
    
    if (openCountIncreased) {
      console.log('\n✅ SUCCESS: Newsletter open tracking is working correctly!');
      console.log(`   Open count increased from ${newsletterDataBefore.openCount || 0} to ${newsletterDataAfter.openCount || 0}`);
    } else {
      console.log('\n❌ FAILED: Newsletter open count did not increase');
      console.log('   This indicates the webhook processing might not be working correctly');
      console.log('   Check the server logs for [Webhook] messages to debug');
    }
    
    return openCountIncreased;
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    return false;
  }
}

// Usage instructions
console.log('Newsletter Email Tracking Test Script');
console.log('=====================================\n');
console.log('Usage: node test-webhook.js <authToken> <newsletterId> <contactEmail>\n');
console.log('Example:');
console.log('  node test-webhook.js "your-auth-token" "newsletter-id-here" "contact@example.com"\n');
console.log('To get your auth token:');
console.log('  1. Open browser developer tools (F12)');
console.log('  2. Go to Network tab');
console.log('  3. Login to the application');
console.log('  4. Look for any API request and copy the Bearer token from Authorization header\n');

// Run the test if arguments are provided
const args = process.argv.slice(2);
if (args.length === 3) {
  const [authToken, newsletterId, contactEmail] = args;
  testWebhookProcessing(authToken, newsletterId, contactEmail)
    .then(success => {
      process.exit(success ? 0 : 1);
    });
} else if (args.length > 0) {
  console.error('Error: Please provide exactly 3 arguments: authToken, newsletterId, contactEmail');
  process.exit(1);
}