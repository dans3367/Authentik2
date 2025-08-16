import fetch from 'node-fetch';

async function testNewsletterSend() {
  console.log('Testing newsletter send functionality...\n');
  
  // First, let's login to get an access token
  console.log('1. Logging in to get access token...');
  const loginResponse = await fetch('http://127.0.0.1:4000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('Login failed:', await loginResponse.text());
    return;
  }
  
  const loginData = await loginResponse.json();
  const accessToken = loginData.accessToken;
  console.log('✓ Login successful, got access token\n');
  
  // Test direct call to Go server
  console.log('2. Testing direct call to Go server /api/email-tracking...');
  const testPayload = {
    emailId: `test-email-${Date.now()}`,
    status: "queued",
    temporalWorkflow: `test-workflow-${Date.now()}`,
    metadata: {
      recipient: "test@example.com",
      subject: "Test Newsletter",
      content: "This is a test",
      templateType: "newsletter",
      priority: "normal",
      to: "test@example.com",
      sentAt: new Date().toISOString(),
    }
  };
  
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const goServerResponse = await fetch('https://tengine.zendwise.work/api/email-tracking', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log('Go server response status:', goServerResponse.status);
    const responseText = await goServerResponse.text();
    console.log('Go server response:', responseText);
    
    if (goServerResponse.ok) {
      console.log('✓ Go server accepted the request\n');
    } else {
      console.log('✗ Go server rejected the request\n');
    }
  } catch (error) {
    console.error('Error calling Go server:', error.message);
  }
  
  // Now test the newsletter send endpoint
  console.log('3. Creating a test newsletter...');
  const createNewsletterResponse = await fetch('http://127.0.0.1:4000/api/newsletters', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Test Newsletter',
      subject: 'Test Subject',
      content: '<p>Test content</p>',
      status: 'draft',
      recipientType: 'all'
    })
  });
  
  if (!createNewsletterResponse.ok) {
    console.error('Failed to create newsletter:', await createNewsletterResponse.text());
    return;
  }
  
  const { newsletter } = await createNewsletterResponse.json();
  console.log(`✓ Created newsletter with ID: ${newsletter.id}\n`);
  
  // Test sending the newsletter
  console.log('4. Testing newsletter send endpoint...');
  const sendResponse = await fetch(`http://127.0.0.1:4000/api/newsletters/${newsletter.id}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Send response status:', sendResponse.status);
  const sendResult = await sendResponse.text();
  console.log('Send response:', sendResult);
  
  if (sendResponse.ok) {
    console.log('\n✓ Newsletter send endpoint worked!');
  } else {
    console.log('\n✗ Newsletter send endpoint failed');
  }
}

testNewsletterSend().catch(console.error);