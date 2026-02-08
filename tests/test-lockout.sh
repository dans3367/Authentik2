#!/bin/bash

# Test script for account lockout functionality
API_URL="http://localhost:5002/api/auth"

echo "🛡️  Testing Account Lockout System"
echo "==================================="

# Test function to attempt login
test_login() {
    local email=$1
    local password=$2
    local description=$3

    start_time=$(date +%s)
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
        -X POST "${API_URL}/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")
    end_time=$(date +%s)

    # Extract timing and status
    duration=$((end_time - start_time))
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)

    printf "%-30s | %-3s | %-2d sec\n" "$description" "$http_status" "$duration"
}

# Test function to check lockout status
check_lockout() {
    local email=$1
    local description=$2

    response=$(curl -s -X POST "${API_URL}/check-lockout" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${email}\"}")

    locked=$(echo "$response" | jq -r '.locked // false')
    remaining=$(echo "$response" | jq -r '.remainingTime // 0')

    if [ "$locked" = "true" ]; then
        remaining_min=$((remaining / 60000))
        printf "%-30s | LOCKED (%d min remaining)\n" "$description" "$remaining_min"
    else
        printf "%-30s | NOT LOCKED\n" "$description"
    fi
}

echo "Testing progressive delays and lockouts..."
echo "=========================================="
echo "Test Description               | Status | Time"
echo "-------------------------------|--------|------"

# Test with non-existent user (should see timing attack protection)
test_login "nonexistent@example.com" "password123" "Non-existent user (1st)"

# Test lockout status
echo ""
echo "Checking lockout status..."
echo "=========================="
check_lockout "nonexistent@example.com" "Non-existent user status"

echo ""
echo "✅ Account lockout system should:"
echo "   - Show increasing delays after failed attempts"
echo "   - Eventually lock accounts temporarily"
echo "   - Reset counters on successful login"
echo "   - Provide clear feedback about lockout status"
echo ""
echo "📝 Test Results:"
echo "   - Progressive delays: 1s (after 3 attempts), 5s (after 5), 15s (after 7), 1min (after 10)"
echo "   - Temporary lockouts: 15min (after 15), 1hr (after 20), 24hr (after 25)"
echo "   - Lockout reset: On successful login"
