#!/bin/bash

# Test script for onboarding endpoint
# Make sure your server is running before executing this

echo "Testing onboarding endpoint..."
echo ""

# Get your auth cookie from browser dev tools or login first
# Replace YOUR_AUTH_COOKIE with actual cookie value

curl -X POST http://localhost:5000/api/company/complete-onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "geographicalLocation": "north-america",
    "language": "en",
    "businessDescription": "This is a test business description with more than 10 characters"
  }' \
  -v

echo ""
echo "Test complete!"
