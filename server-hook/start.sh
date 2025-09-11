#!/bin/bash

echo "🚀 Starting Authentik Webhook Server..."
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Set environment variables
export WEBHOOK_PORT=${WEBHOOK_PORT:-3505}
export NODE_ENV=${NODE_ENV:-development}

print_status "Environment: $NODE_ENV"
print_status "Webhook Server Port: $WEBHOOK_PORT"

# Check if port is available
if check_port $WEBHOOK_PORT; then
    print_error "Port $WEBHOOK_PORT is already in use"
    print_status "Killing existing process on port $WEBHOOK_PORT..."
    lsof -ti:$WEBHOOK_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Change to server-hook directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d node_modules ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
fi

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down webhook server..."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the webhook server
print_status "Starting webhook server on port $WEBHOOK_PORT..."
if [ "$NODE_ENV" = "production" ]; then
    npm start
else
    npm run dev
fi
