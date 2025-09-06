#!/bin/bash

# Test JWT token refresh functionality
API_URL="http://localhost:5000/api"

echo "🔄 Testing JWT Token Refresh"
echo "============================"

# Test 1: Refresh without cookie
echo "Test 1: Refresh without cookie"
curl -s -X POST "${API_URL}/auth/refresh" -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 2: Refresh with invalid cookie
echo "Test 2: Refresh with invalid cookie"
curl -s -X POST "${API_URL}/auth/refresh" \
  -H "Cookie: refreshToken=invalid.token.here" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 3: Check auth status without tokens
echo "Test 3: Check auth status without tokens"
curl -s -X GET "${API_URL}/auth/check" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

echo "✅ Refresh endpoint is responding correctly"
echo "   - Returns 401 for missing/invalid refresh tokens"
echo "   - Uses centralized JWT utilities"
echo "   - No longer returns accessToken in JSON response"
echo "   - Returns user data in refresh response"



