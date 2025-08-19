#!/bin/bash

set -e

echo "🚀 Starting Postmark Email System (Worker + Server)..."

cd "$(dirname "$0")"

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📋 Loading environment variables from .env file..."
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

# Ensure CONFIG_FILE defaults to our Postmark config
export CONFIG_FILE=${CONFIG_FILE:-"$(pwd)/config/postmark-config.yaml"}

echo "📋 Using CONFIG_FILE=$CONFIG_FILE"

# Build both Postmark worker and server
echo "🔨 Building Postmark worker and server..."
go build -o postmark-worker ./cmd/postmark-worker/main.go
go build -o server ./cmd/server/main.go

echo ""
echo "🔄 Starting Postmark services..."

# Start Postmark worker in background
echo "📧 Starting Postmark Temporal worker..."
./postmark-worker &
WORKER_PID=$!

# Wait a moment for worker to start
sleep 2

# Start server in background
echo "🌐 Starting HTTP server..."
./server &
SERVER_PID=$!

echo ""
echo "✅ Postmark services started successfully!"
echo "   📧 Postmark Worker PID: $WORKER_PID"
echo "   🌐 Server PID: $SERVER_PID"
echo ""
echo "📋 Configuration:"
echo "   🔗 Config File: $CONFIG_FILE"
echo "   🔗 Task Queue: postmark-email-task-queue"
echo "   🔗 Postmark API: Using provided API key"
echo ""
echo "📋 Service URLs:"
echo "   🔗 Health Check: http://localhost:8095/health"
echo "   🔗 API Endpoint: http://localhost:8095/api/email-tracking"
echo ""
echo "🛑 To stop services:"
echo "   kill $WORKER_PID $SERVER_PID"
echo ""
echo "📝 Logs are being written to stdout/stderr"
echo "   Press Ctrl+C to stop all Postmark services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping Postmark services..."
    kill $WORKER_PID $SERVER_PID 2>/dev/null
    echo "✅ Postmark services stopped"
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
