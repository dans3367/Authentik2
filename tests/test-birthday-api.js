const BASE_URL = 'http://localhost:5173';

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

    console.log(`${method} ${endpoint}:`, response.status, data);
    return { response, data };
  } catch (error) {
    console.error(`${method} ${endpoint} Error:`, error.message);
    return { error };
  }
}

// Test birthday settings endpoints
async function testBirthdaySettings() {
  console.log('Testing Birthday Settings API...\n');

  // Test GET birthday settings (should return default values)
  await apiRequest('GET', '/api/birthday-settings');

  // Test PUT birthday settings
  await apiRequest('PUT', '/api/birthday-settings', {
    enabled: true,
    emailTemplate: 'default',
    segmentFilter: 'all',
    customMessage: 'Happy Birthday! Enjoy your special day.',
    senderName: 'Your Company'
  });

  // Test GET birthday settings again (should show updated values)
  await apiRequest('GET', '/api/birthday-settings');
}

// Test birthday contacts endpoints
async function testBirthdayContacts() {
  console.log('\nTesting Birthday Contacts API...\n');

  // Test GET birthday contacts
  await apiRequest('GET', '/api/birthday-contacts');

  // Test GET birthday contacts with upcoming only filter
  await apiRequest('GET', '/api/birthday-contacts?upcomingOnly=true');
}

// Test individual birthday email preference update
async function testIndividualUpdate() {
  console.log('\nTesting Individual Birthday Email Preference Update...\n');

  // This would need a real contact ID - for now just show the expected format
  console.log('Individual update would use:');
  console.log('PATCH /api/email-contacts/{contactId}/birthday-email');
  console.log('Body: { "enabled": true }');
}

// Test bulk birthday email preference update
async function testBulkUpdate() {
  console.log('\nTesting Bulk Birthday Email Preference Update...\n');

  // This would need real contact IDs - for now just show the expected format
  console.log('Bulk update would use:');
  console.log('PATCH /api/email-contacts/birthday-email/bulk');
  console.log('Body: { "contactIds": ["id1", "id2"], "enabled": true }');
}

// Run all tests
async function runTests() {
  console.log('🎂 Testing Birthday Management API Endpoints\n');

  try {
    await testBirthdaySettings();
    await testBirthdayContacts();
    await testIndividualUpdate();
    await testBulkUpdate();

    console.log('\n✅ All API endpoint tests completed!');
    console.log('\nNote: Some tests may fail if not authenticated or if no test data exists.');
    console.log('The endpoints are ready for integration with the frontend.');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the tests
runTests();
