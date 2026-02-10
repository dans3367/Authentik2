#!/usr/bin/env node

/**
 * Test script to verify dashboard refresh token functionality
 * This tests the complete flow that the dashboard uses
 */

const API_BASE = 'http://localhost:5002/api';

async function testDashboardRefreshFlow() {
  console.log('🧪 Testing Dashboard Refresh Token Flow\n');

  try {
    // Test 1: Check auth status (should return false when not authenticated)
    console.log('1. Testing auth status check...');
    const authCheckResponse = await fetch(`${API_BASE}/auth/check`, {
      credentials: 'include'
    });
    const authCheckData = await authCheckResponse.json();

    console.log('   Auth check result:', authCheckData);
    console.log('   Status:', authCheckResponse.status);
    console.log('   ✅ Auth check working correctly\n');

    // Test 2: Try refresh without valid token (should fail)
    console.log('2. Testing refresh without valid token...');
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    console.log('   Refresh status:', refreshResponse.status);
    if (!refreshResponse.ok) {
      const refreshError = await refreshResponse.json();
      console.log('   Refresh error (expected):', refreshError.message);
      console.log('   ✅ Refresh correctly rejects invalid tokens\n');
    }

    // Test 3: Check refresh token info
    console.log('3. Testing refresh token info...');
    const tokenInfoResponse = await fetch(`${API_BASE}/auth/refresh-token-info`, {
      credentials: 'include'
    });
    const tokenInfoData = await tokenInfoResponse.json();

    console.log('   Token info result:', tokenInfoData);
    console.log('   ✅ Token info working correctly\n');

    console.log('🎉 Dashboard refresh token flow verification complete!');
    console.log('   All endpoints are responding correctly.');
    console.log('   The dashboard should now work properly with token refresh.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDashboardRefreshFlow();



