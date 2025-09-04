#!/bin/bash

# Test logout all devices functionality
API_URL="http://localhost:3001/api"

# First, get the current access token from the browser
echo "Please provide your current access token from the browser (check Network tab):"
read -p "Access Token: " ACCESS_TOKEN

if [ -z "$ACCESS_TOKEN" ]; then
    echo "No token provided. Exiting."
    exit 1
fi

echo -e "\nTesting API access BEFORE logout all devices..."
echo "1. Testing /api/auth/me:"
curl -s -X GET "${API_URL}/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n2. Testing /api/auth/debug-token:"
curl -s -X GET "${API_URL}/auth/debug-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq . 2>/dev/null || echo "Response received"

echo -e "\n3. Testing /api/auth/sessions:"
curl -s -X GET "${API_URL}/auth/sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n" | head -50

echo -e "\n4. Testing /api/auth/logout-all endpoint:"
curl -s -X POST "${API_URL}/auth/logout-all" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n==============================================="
echo "Now please click 'Log Out All Other Devices' in the browser"
read -p "Press Enter after clicking logout all devices: "

echo -e "\nTesting API access AFTER logout all devices..."
echo "1. Testing /api/auth/me (should fail):"
curl -s -X GET "${API_URL}/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n2. Testing /api/auth/debug-token (should fail):"
curl -s -X GET "${API_URL}/auth/debug-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n3. Testing /api/auth/sessions (should fail):"
curl -s -X GET "${API_URL}/auth/sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\nTest completed."
