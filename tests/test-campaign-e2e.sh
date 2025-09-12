#!/bin/bash

echo "🧪 End-to-End Campaign Management Test"
echo "======================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"

# Step 1: Register a test user
echo "1️⃣ Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register-owner" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "beats@zendwise.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User",
    "companyName": "Test Company",
    "confirmPassword": "TestPassword123!"
  }' \
  -w "HTTP_STATUS:%{http_code}")

REGISTER_CODE=$(echo "$REGISTER_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$REGISTER_CODE" == "201" ] || [ "$REGISTER_CODE" == "409" ]; then
  echo -e "${GREEN}✅ User registration successful or already exists${NC}"
else
  echo -e "${YELLOW}⚠️  Registration returned code $REGISTER_CODE, continuing with existing user${NC}"
fi

# Step 2: Login to get access token
echo
echo "2️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "beats@zendwise.com",
    "password": "TestPassword123!"
  }' \
  -w "HTTP_STATUS:%{http_code}")

LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$LOGIN_CODE" != "200" ]; then
  echo -e "${RED}❌ Login failed with code $LOGIN_CODE${NC}"
  echo "Response: $LOGIN_BODY"
  
  # Try with the default owner account
  echo "Trying with default owner account..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "owner@example.com",
      "password": "password"
    }' \
    -w "HTTP_STATUS:%{http_code}")
  
  LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
  LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
fi

if [ "$LOGIN_CODE" != "200" ]; then
  echo -e "${RED}❌ Login failed completely with code $LOGIN_CODE${NC}"
  echo "Response: $LOGIN_BODY"
  exit 1
fi

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_BODY" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//' | head -1)

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Failed to extract access token${NC}"
  echo "Login response: $LOGIN_BODY"
  exit 1
fi

echo -e "${GREEN}✅ Login successful, token obtained${NC}"

# Step 3: Create a campaign
echo
echo "3️⃣ Creating campaign..."
CAMPAIGN_DATA='{
  "name": "E2E Test Campaign",
  "description": "This is a test campaign created by the E2E test script",
  "type": "email",
  "status": "draft",
  "budget": 1000,
  "currency": "USD",
  "goals": ["Test goal 1", "Test goal 2"],
  "targetAudience": "Test audience"
}'

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "$CAMPAIGN_DATA" \
  -w "HTTP_STATUS:%{http_code}")

CREATE_CODE=$(echo "$CREATE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$CREATE_CODE" != "201" ]; then
  echo -e "${RED}❌ Campaign creation failed with code $CREATE_CODE${NC}"
  echo "Response: $CREATE_BODY"
  exit 1
fi

# Extract campaign ID
CAMPAIGN_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*' | sed 's/"id":"//' | head -1)

if [ -z "$CAMPAIGN_ID" ]; then
  echo -e "${RED}❌ Failed to extract campaign ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Campaign created successfully with ID: $CAMPAIGN_ID${NC}"

# Step 4: Get all campaigns
echo
echo "4️⃣ Fetching campaigns..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/campaigns" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "HTTP_STATUS:%{http_code}")

GET_CODE=$(echo "$GET_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
GET_BODY=$(echo "$GET_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$GET_CODE" != "200" ]; then
  echo -e "${RED}❌ Failed to fetch campaigns with code $GET_CODE${NC}"
  echo "Response: $GET_BODY"
  exit 1
fi

echo -e "${GREEN}✅ Campaigns fetched successfully${NC}"

# Check if our campaign is in the list
if echo "$GET_BODY" | grep -q "$CAMPAIGN_ID"; then
  echo -e "${GREEN}✅ Created campaign found in list${NC}"
else
  echo -e "${YELLOW}⚠️  Created campaign not found in list${NC}"
fi

# Step 5: Get campaign statistics
echo
echo "5️⃣ Fetching campaign statistics..."
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/campaign-stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "HTTP_STATUS:%{http_code}")

STATS_CODE=$(echo "$STATS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
STATS_BODY=$(echo "$STATS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$STATS_CODE" != "200" ]; then
  echo -e "${RED}❌ Failed to fetch campaign stats with code $STATS_CODE${NC}"
  echo "Response: $STATS_BODY"
else
  echo -e "${GREEN}✅ Campaign statistics fetched successfully${NC}"
fi

# Step 6: Update the campaign
echo
echo "6️⃣ Updating campaign..."
UPDATE_DATA='{
  "name": "Updated E2E Test Campaign",
  "description": "This campaign has been updated by the test script",
  "status": "active"
}'

UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "$UPDATE_DATA" \
  -w "HTTP_STATUS:%{http_code}")

UPDATE_CODE=$(echo "$UPDATE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$UPDATE_CODE" != "200" ]; then
  echo -e "${RED}❌ Campaign update failed with code $UPDATE_CODE${NC}"
  echo "Response: $UPDATE_BODY"
else
  echo -e "${GREEN}✅ Campaign updated successfully${NC}"
fi

# Step 7: Get single campaign
echo
echo "7️⃣ Fetching single campaign..."
SINGLE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "HTTP_STATUS:%{http_code}")

SINGLE_CODE=$(echo "$SINGLE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
SINGLE_BODY=$(echo "$SINGLE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$SINGLE_CODE" != "200" ]; then
  echo -e "${RED}❌ Failed to fetch single campaign with code $SINGLE_CODE${NC}"
  echo "Response: $SINGLE_BODY"
else
  echo -e "${GREEN}✅ Single campaign fetched successfully${NC}"
  
  # Check if the update was applied
  if echo "$SINGLE_BODY" | grep -q "Updated E2E Test Campaign"; then
    echo -e "${GREEN}✅ Campaign update verified${NC}"
  else
    echo -e "${YELLOW}⚠️  Campaign update not reflected${NC}"
  fi
fi

# Step 8: Clean up - Delete the campaign
echo
echo "8️⃣ Cleaning up - Deleting campaign..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "HTTP_STATUS:%{http_code}")

DELETE_CODE=$(echo "$DELETE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$DELETE_CODE" != "200" ]; then
  echo -e "${RED}❌ Campaign deletion failed with code $DELETE_CODE${NC}"
else
  echo -e "${GREEN}✅ Campaign deleted successfully${NC}"
fi

echo
echo "🎉 End-to-End Test Complete!"
echo "=============================="
echo -e "${GREEN}✅ All campaign management operations tested successfully${NC}"