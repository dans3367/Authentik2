#!/bin/bash

echo "Starting Full Application with Form Server..."
echo "============================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    pkill -f "tsx server/index.ts" 2>/dev/null
    pkill -f "tsx fserver/index.ts" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start main application server
echo "🚀 Starting main application server on port 3500..."
NODE_ENV=development tsx server/index.ts &
MAIN_PID=$!

# Wait for main server to start
sleep 3

# Start form server backend
echo "🚀 Starting form server backend on port 3001..."
cd fserver
NODE_ENV=development tsx index.ts &
FORM_BACKEND_PID=$!

# Wait for form backend to start
sleep 2

# Start form server frontend
echo "🚀 Starting form server frontend on port 3002..."
npm run dev:client &
FORM_FRONTEND_PID=$!

cd ..

echo ""
echo "✅ All servers started successfully!"
echo "============================================="
echo "📊 Main Application:     http://localhost:3500"
echo "🔗 Form Server API:      http://localhost:3001/api"
echo "📝 Form Server Frontend: http://localhost:3002"
echo ""
echo "Process IDs:"
echo "  Main Server: $MAIN_PID"
echo "  Form Backend: $FORM_BACKEND_PID"
echo "  Form Frontend: $FORM_FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "============================================="

# Wait for any process to exit
wait