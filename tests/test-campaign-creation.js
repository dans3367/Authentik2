#!/usr/bin/env node

const axios = require('axios');

async function testCampaignCreation() {
  console.log('🧪 Testing Campaign Creation API...\n');

  const baseURL = 'http://localhost:5002';

  try {
    // Step 1: Login to get valid token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${baseURL}/api/login`, {
      email: 'beats@zendwise.work',
      password: 'password'
    });

    const { accessToken } = loginResponse.data;
    console.log('✅ Login successful, token received');

    // Step 2: Test campaign creation
    console.log('\n2️⃣ Creating campaign...');
    const campaignData = {
      name: 'Test Campaign API',
      description: 'Test campaign created via API',
      type: 'email',
      status: 'draft',
      currency: 'USD',
      goals: ['Increase engagement', 'Generate leads']
    };

    console.log('📤 Sending request:', {
      url: `${baseURL}/api/campaigns`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      data: campaignData
    });

    const campaignResponse = await axios.post(`${baseURL}/api/campaigns`, campaignData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('✅ Campaign created successfully:', campaignResponse.data);

    // Step 3: Verify campaign exists
    console.log('\n3️⃣ Fetching campaigns...');
    const campaignsResponse = await axios.get(`${baseURL}/api/campaigns`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('✅ Campaigns fetched:', campaignsResponse.data);

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Headers:', error.response?.headers);
    console.error('Data:', error.response?.data);
    console.error('Full Error:', error.message);

    if (error.response?.data) {
      console.error('Response Body:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testCampaignCreation();