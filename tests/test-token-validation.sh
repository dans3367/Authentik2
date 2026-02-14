#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:5000/api"
EMAIL="dan@zendwise.com"
PASSWORD="Test123!"

echo -e "${YELLOW}Starting Token Validation Test${NC}"
echo "=============================="

# Step 1: Login to get tokens
echo -e "\n${GREEN}Step 1: Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
echo "Access token: ${ACCESS_TOKEN:0:20}..."

# Step 2: Test debug endpoint to see token info
echo -e "\n${GREEN}Step 2: Check token info${NC}"
DEBUG_RESPONSE=$(curl -s -X GET "${API_URL}/auth/debug-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Token debug info:"
echo $DEBUG_RESPONSE | python3 -m json.tool

# Step 3: Get sessions
echo -e "\n${GREEN}Step 3: Get current sessions${NC}"
SESSIONS_RESPONSE=$(curl -s -X GET "${API_URL}/auth/sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Sessions:"
echo $SESSIONS_RESPONSE | python3 -m json.tool | head -20

# Step 4: Test API access
echo -e "\n${GREEN}Step 4: Test API access (should work)${NC}"
ME_RESPONSE=$(curl -s -X GET "${API_URL}/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Me response:"
echo $ME_RESPONSE | python3 -m json.tool | head -10

echo -e "\n${YELLOW}Now manually logout all devices from another browser, then press Enter to continue...${NC}"
read -p "Press Enter after logging out all devices: "

# Step 5: Test API access after logout
echo -e "\n${RED}Step 5: Test API access after logout all devices${NC}"
ME_RESPONSE_AFTER=$(curl -s -X GET "${API_URL}/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}")

echo "Me response after logout:"
echo "$ME_RESPONSE_AFTER"

# Step 6: Check token debug info again
echo -e "\n${RED}Step 6: Check token info after logout${NC}"
DEBUG_RESPONSE_AFTER=$(curl -s -X GET "${API_URL}/auth/debug-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}")

echo "Token debug info after logout:"
echo "$DEBUG_RESPONSE_AFTER"

# Clean up
rm -f cookies.txt

echo -e "\n${YELLOW}Test completed${NC}"
