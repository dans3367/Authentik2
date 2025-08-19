#!/usr/bin/env node

// Test script to verify newsletter email tracking is working
// Run this script after logging in to test the webhook processing

const BASE_URL = 'http://localhost:5000';

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
    
    // 2. Simulate an email open via the test endpoint
    console.log('\n2. Simulating email open webhook...');
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
      throw new Error(`Test webhook failed: ${error}`);
    }
    
    const testResult = await testResponse.json();
    console.log(`   Previous open count: ${testResult.previousOpenCount}`);
    console.log(`   New open count: ${testResult.newOpenCount}`);
    
    // 3. Verify the newsletter stats were updated
    console.log('\n3. Fetching updated newsletter stats...');
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
    
    // 4. Check if the update worked
    const openCountIncreased = (newsletterDataAfter.openCount || 0) > (newsletterDataBefore.openCount || 0);
    
    if (openCountIncreased) {
      console.log('\n✅ SUCCESS: Newsletter open tracking is working correctly!');
      console.log(`   Open count increased from ${newsletterDataBefore.openCount || 0} to ${newsletterDataAfter.openCount || 0}`);
    } else {
      console.log('\n❌ FAILED: Newsletter open count did not increase');
      console.log('   This indicates the webhook processing might not be working correctly');
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