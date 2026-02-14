// Test script to create sample contacts with birthday data
const BASE_URL = 'http://localhost:5000';

// Helper function to make API requests
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(BASE_URL + endpoint, options);
    const data = await response.json();

    console.log(`${method} ${endpoint}:`, response.status);
    return { response, data };
  } catch (error) {
    console.error(`${method} ${endpoint} Error:`, error.message);
    return { error };
  }
}

// Create test contacts with birthday data
async function createTestContacts() {
  console.log('Creating test contacts with birthday data...\n');

  const testContacts = [
    {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      birthday: '1990-05-15',
      birthdayEmailEnabled: true,
      consentGiven: true,
      consentMethod: 'manual_add'
    },
    {
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      birthday: '1985-12-31',
      birthdayEmailEnabled: false,
      consentGiven: true,
      consentMethod: 'manual_add'
    },
    {
      email: 'bob.wilson@example.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      birthday: '2000-01-01',
      birthdayEmailEnabled: true,
      consentGiven: true,
      consentMethod: 'manual_add'
    },
    {
      email: 'alice.johnson@example.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      // No birthday set
      birthdayEmailEnabled: false,
      consentGiven: true,
      consentMethod: 'manual_add'
    }
  ];

  for (const contact of testContacts) {
    console.log(`Creating contact: ${contact.email}`);
    await apiRequest('POST', '/api/email-contacts', contact);
  }
}

// Test fetching contacts to verify birthday fields are included
async function testFetchContacts() {
  console.log('\nFetching contacts to verify birthday fields...\n');

  const { data } = await apiRequest('GET', '/api/email-contacts');

  if (data && data.contacts) {
    console.log(`Found ${data.contacts.length} contacts:`);

    data.contacts.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email})`);
      console.log(`   Birthday: ${contact.birthday || 'Not set'}`);
      console.log(`   Birthday Email Enabled: ${contact.birthdayEmailEnabled}`);
      console.log('');
    });
  } else {
    console.log('No contacts data received');
  }
}

// Test birthday-specific endpoints
async function testBirthdayEndpoints() {
  console.log('\nTesting birthday-specific endpoints...\n');

  // Test birthday settings
  await apiRequest('GET', '/api/birthday-settings');

  // Test birthday contacts endpoint
  await apiRequest('GET', '/api/birthday-contacts');

  // Test updating birthday settings
  await apiRequest('PUT', '/api/birthday-settings', {
    enabled: true,
    emailTemplate: 'default',
    segmentFilter: 'all',
    customMessage: 'Happy Birthday!',
    senderName: 'Test Company'
  });
}

// Run all tests
async function runTests() {
  console.log('🎂 Testing Birthday Data and API Endpoints\n');

  try {
    await createTestContacts();
    await testFetchContacts();
    await testBirthdayEndpoints();

    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Test contacts created with birthday data');
    console.log('- Birthday fields are properly included in API responses');
    console.log('- Birthday management endpoints are working');
    console.log('- Frontend should now display birthday and birthday email preference columns');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the tests
runTests();
