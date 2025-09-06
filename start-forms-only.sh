#!/bin/bash

echo "Starting Form Server Only..."
echo "============================"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down form servers..."
    pkill -f "tsx fserver/index.ts" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

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
echo "✅ Form servers started successfully!"
echo "====================================="
echo "🔗 Form Server API:      http://localhost:5000/api"
echo "📝 Form Server Frontend: http://localhost:3002"
echo ""
echo "Process IDs:"
echo "  Form Backend: $FORM_BACKEND_PID"
echo "  Form Frontend: $FORM_FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "====================================="

# Wait for any process to exit
wait