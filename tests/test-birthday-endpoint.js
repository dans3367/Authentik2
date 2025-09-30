// Test the birthday test endpoint directly
async function testBirthdayEndpoint() {
  const response = await fetch('http://localhost:3502/api/birthday-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // This will fail auth but we can see the logs
    },
    body: JSON.stringify({
      userId: 'test-user',
      userEmail: 'test@example.com',
      userFirstName: 'Test',
      userLastName: 'User',
      tenantId: '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff', // One of the tenants with promotion
      tenantName: 'Test Tenant',
      fromEmail: 'admin@zendwise.work',
      isTest: true,
      emailTemplate: 'default',
      customMessage: 'Test birthday message',
      senderName: 'Test Sender'
    })
  });

  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Response data:', data);
}

testBirthdayEndpoint().catch(console.error);
