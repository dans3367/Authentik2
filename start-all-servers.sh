#!/bin/bash

echo "Starting Full Application..."
echo "============================================="
echo "NOTE: Form server has been merged into the main server."
echo "      Public forms are served at /form/:id"
echo "============================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    pkill -f "tsx server/index.ts" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start main application server
echo "🚀 Starting main application server on port 5002..."
NODE_ENV=development npx tsx server/index.ts &
MAIN_PID=$!

# Wait for main server to start
sleep 3

echo ""
echo "✅ All servers started successfully!"
echo "============================================="
echo "📊 Main Application:     http://localhost:5002"
echo "� Public Forms:         http://localhost:5002/form/:id"
echo ""
echo "Process IDs:"
echo "  Main Server: $MAIN_PID"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "============================================="

# Wait for any process to exit
wait