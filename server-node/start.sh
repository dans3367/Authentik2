#!/bin/bash

# Start script for Authentik Temporal Services (server-node + temporal-server)
echo "🚀 Starting Authentik Temporal Services..."
echo "=========================================="

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
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process using a specific port
kill_port_process() {
    local port=$1
    print_warning "Port $port is in use, searching for process..."

    # Find the PID of the process using the port
    local pid=$(lsof -ti:$port)

    if [ ! -z "$pid" ]; then
        print_warning "Found process $pid using port $port"

        # Get process information for logging
        local process_info=$(ps -p $pid -o pid,ppid,cmd | tail -1)
        print_warning "Process details: $process_info"

        # Kill the process
        print_warning "Terminating process $pid..."
        kill -9 $pid 2>/dev/null

        # Wait a moment for the process to die
        sleep 2

        # Check if the port is now free
        if check_port $port; then
            print_error "Failed to kill process on port $port"
            return 1
        else
            print_success "Successfully killed process on port $port"
            return 0
        fi
    else
        print_warning "No process found using port $port"
        return 1
    fi
}

# Set environment variables for both services
export PORT=3502
export NODE_ENV=${NODE_ENV:-development}
export TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-172.18.0.4:7233}
export TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-default}
export TEMPORAL_TASK_QUEUE=${TEMPORAL_TASK_QUEUE:-authentik-tasks}
export TEMPORAL_SERVER_PORT=${TEMPORAL_SERVER_PORT:-50051}
export DATABASE_URL=${DATABASE_URL:-postgresql://localhost:5432/authentik}
export BACKEND_URL=${BACKEND_URL:-http://localhost:5000}

print_status "Environment: $NODE_ENV"
print_status "Temporal Address: $TEMPORAL_ADDRESS"
print_status "Server-node Port: $PORT"
print_status "Temporal Server Port: $TEMPORAL_SERVER_PORT"

# Check required ports
print_status "Checking required ports..."
if check_port $PORT; then
    print_warning "Server-node port $PORT is already in use"
    if kill_port_process $PORT; then
        print_success "Port $PORT is now available"
    else
        print_error "Failed to free port $PORT"
        exit 1
    fi
fi

if check_port $TEMPORAL_SERVER_PORT; then
    print_warning "Temporal server port $TEMPORAL_SERVER_PORT is already in use"
    if kill_port_process $TEMPORAL_SERVER_PORT; then
        print_success "Port $TEMPORAL_SERVER_PORT is now available"
    else
        print_error "Failed to free port $TEMPORAL_SERVER_PORT"
        exit 1
    fi
fi
print_success "All required ports are available"

# Function to cleanup background processes on exit
cleanup() {
    print_status "Shutting down services..."
    if [ ! -z "$TEMPORAL_SERVER_PID" ]; then
        print_status "Stopping temporal server (PID: $TEMPORAL_SERVER_PID)"
        kill $TEMPORAL_SERVER_PID 2>/dev/null
        wait $TEMPORAL_SERVER_PID 2>/dev/null
    fi
    if [ ! -z "$SERVER_NODE_PID" ]; then
        print_status "Stopping server-node (PID: $SERVER_NODE_PID)"
        kill $SERVER_NODE_PID 2>/dev/null
        wait $SERVER_NODE_PID 2>/dev/null
    fi
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Change to project root directory (assuming this script is in server-node/)
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Setup temporal-server
print_status "Setting up temporal-server..."
cd "$PROJECT_ROOT/temporal-server"

# Check if .env file exists, if not copy from example
if [ ! -f .env ]; then
    if [ -f config.example.env ]; then
        print_status "Creating .env file from example..."
        cp config.example.env .env
        print_warning "Please configure .env file with your actual values"
    fi
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    print_status "Installing dependencies for temporal-server..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies for temporal-server"
        exit 1
    fi
fi

# Generate protobuf files
print_status "Generating protobuf files for temporal-server..."
npm run proto:generate 2>/dev/null || print_warning "Proto generation may have failed, continuing..."

# Start temporal-server in background
print_status "Starting temporal-server on port $TEMPORAL_SERVER_PORT..."
if [ "$NODE_ENV" = "production" ]; then
    npm run build && npm start &
else
    npm run dev &
fi
TEMPORAL_SERVER_PID=$!

# Go back to project root
cd "$PROJECT_ROOT"

# Give temporal-server time to start
print_status "Waiting for temporal-server to initialize..."
sleep 5

# Check if temporal-server is running
if ! kill -0 $TEMPORAL_SERVER_PID 2>/dev/null; then
    print_error "Temporal server failed to start"
    cleanup
    exit 1
fi
print_success "Temporal server started (PID: $TEMPORAL_SERVER_PID)"

# Now start server-node
print_status "Starting server-node on port $PORT..."
cd "$PROJECT_ROOT/server-node"

# Install dependencies if needed for server-node
if [ ! -d node_modules ]; then
    print_status "Installing dependencies for server-node..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies for server-node"
        cleanup
        exit 1
    fi
fi

# Start server-node
npm run dev &
SERVER_NODE_PID=$!

# Give server-node time to start
sleep 3

# Check if server-node is running
if ! kill -0 $SERVER_NODE_PID 2>/dev/null; then
    print_error "Server-node failed to start"
    cleanup
    exit 1
fi

print_success "Server-node started (PID: $SERVER_NODE_PID)"

# Print status
echo ""
print_success "🎉 Authentik Temporal Services are running!"
echo "=============================================="
print_status "Server-node: http://localhost:$PORT"
print_status "Temporal Server: localhost:$TEMPORAL_SERVER_PORT"
print_status "Temporal Address: $TEMPORAL_ADDRESS"
echo ""
print_status "Server-node PID: $SERVER_NODE_PID"
print_status "Temporal Server PID: $TEMPORAL_SERVER_PID"
echo ""
print_warning "Press Ctrl+C to stop all services"
echo ""

# Monitor both processes
while true; do
    # Check if temporal-server is still running
    if ! kill -0 $TEMPORAL_SERVER_PID 2>/dev/null; then
        print_error "Temporal server stopped unexpectedly"
        cleanup
        exit 1
    fi

    # Check if server-node is still running
    if ! kill -0 $SERVER_NODE_PID 2>/dev/null; then
        print_error "Server-node stopped unexpectedly"
        cleanup
        exit 1
    fi

    sleep 5
done


