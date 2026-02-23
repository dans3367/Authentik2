#!/bin/bash

echo "🧪 Testing Campaign Creation API..."
echo

# Step 1: Login to get token
echo "1️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"beats@zendwise.work","password":"password"}')

echo "Login Response: $LOGIN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Access token obtained: ${ACCESS_TOKEN:0:20}..."
echo

# Step 2: Test campaign creation
echo "2️⃣ Creating campaign..."
CAMPAIGN_DATA='{
  "name": "Test Campaign Shell",
  "description": "Test campaign created via shell script",
  "type": "email",
  "status": "draft",
  "currency": "USD",
  "goals": ["Increase engagement", "Generate leads"]
}'

echo "📤 Sending campaign creation request..."
CAMPAIGN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "$CAMPAIGN_DATA" \
  -w "HTTP_STATUS:%{http_code}")

echo "Campaign Response: $CAMPAIGN_RESPONSE"
echo

# Step 3: Get campaigns
echo "3️⃣ Fetching campaigns..."
CAMPAIGNS_RESPONSE=$(curl -s -X GET http://localhost:5000/api/campaigns \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "HTTP_STATUS:%{http_code}")

echo "Campaigns Response: $CAMPAIGNS_RESPONSE"
echo

echo "🎉 Test completed!"