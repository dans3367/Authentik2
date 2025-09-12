#!/bin/bash

set -e

echo "🚀 Starting Temporal Email Worker System..."

# Build first
./build.sh

echo ""
echo "🔄 Starting services..."

# Start worker in background
echo "📧 Starting Temporal worker..."
./worker &
WORKER_PID=$!

# Wait a moment for worker to start
sleep 2

# Start server in background
echo "🌐 Starting HTTP server..."
./server &
SERVER_PID=$!

echo ""
echo "✅ Services started successfully!"
echo "   📧 Worker PID: $WORKER_PID"
echo "   🌐 Server PID: $SERVER_PID"
echo ""
echo "📋 Service URLs:"
echo "   🔗 Health Check: http://localhost:3501/health"
echo "   🔗 API Endpoint: http://localhost:3501/api/email-tracking"
echo ""
echo "🛑 To stop services:"
echo "   kill $WORKER_PID $SERVER_PID"
echo ""
echo "📝 Logs are being written to stdout/stderr"
echo "   Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $WORKER_PID $SERVER_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
