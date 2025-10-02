#!/usr/bin/env node

/**
 * Test script to verify email flow and resend worker functionality
 */

// Using built-in fetch (Node.js 18+)

async function testEmailFlow() {
  console.log('🧪 Testing Email Flow and Resend Worker');
  console.log('=====================================');

  // Test data
  const testEmail = {
    recipient: 'test@example.com',
    subject: 'Test Email from Authentik',
    content: '<h1>Test Email</h1><p>This is a test email to verify the resend worker functionality.</p>',
    templateType: 'general',
    priority: 'normal',
    isScheduled: false
  };

  // Test with missing content
  const testEmailNoContent = {
    recipient: 'test@example.com',
    subject: 'Test Email from Authentik',
    templateType: 'general',
    priority: 'normal',
    isScheduled: false
    // No content field
  };

  try {
    console.log('📧 Sending test email with valid email format...');
    console.log('Test email data:', {
      recipient: testEmail.recipient,
      subject: testEmail.subject,
      templateType: testEmail.templateType,
      priority: testEmail.priority
    });

    // Test 1: Valid email format
    const response1 = await fetch('http://localhost:3502/api/email-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(testEmail)
    });

    const result1 = await response1.json();
    console.log('✅ Valid email test result:', result1);

    // Test 2: Invalid email format
    console.log('\n📧 Testing invalid email format...');
    const invalidEmailTest = { ...testEmail, recipient: 'invalid-email' };
    
    const response2 = await fetch('http://localhost:3502/api/email-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(invalidEmailTest)
    });

    const result2 = await response2.json();
    console.log('❌ Invalid email test result:', result2);

    // Test 3: Missing recipient
    console.log('\n📧 Testing missing recipient...');
    const missingRecipientTest = { ...testEmail };
    delete missingRecipientTest.recipient;

    const response3 = await fetch('http://localhost:3502/api/email-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(missingRecipientTest)
    });

    const result3 = await response3.json();
    console.log('❌ Missing recipient test result:', result3);

    // Test 4: Missing content
    console.log('\n📧 Testing missing content...');
    const response4 = await fetch('http://localhost:3502/api/email-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(testEmailNoContent)
    });

    const result4 = await response4.json();
    console.log('❌ Missing content test result:', result4);

    console.log('\n🎉 All tests completed!');
    console.log('\nSummary:');
    console.log('- Valid email should create workflow with temporal ID');
    console.log('- Invalid email should be rejected with validation error');
    console.log('- Missing recipient should be rejected with validation error');
    console.log('- Missing content should be rejected with validation error');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEmailFlow();
}

export { testEmailFlow };
