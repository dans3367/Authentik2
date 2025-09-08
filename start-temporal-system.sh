#!/bin/bash

# Comprehensive startup script for Authentik Temporal System

echo "🚀 Starting Authentik Temporal System..."
echo "=====================================\n"

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

# Function to install dependencies
install_dependencies() {
    local dir=$1
    local name=$2
    
    if [ ! -d "$dir/node_modules" ]; then
        print_status "Installing dependencies for $name..."
        cd "$dir"
        npm install
        if [ $? -eq 0 ]; then
            print_success "Dependencies installed for $name"
        else
            print_error "Failed to install dependencies for $name"
            exit 1
        fi
        cd - > /dev/null
    else
        print_status "Dependencies already installed for $name"
    fi
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the Authentik root directory"
    exit 1
fi

# Set default environment
export NODE_ENV=${NODE_ENV:-development}
print_status "Environment: $NODE_ENV"

# Install dependencies for main backend
print_status "Setting up main backend..."
install_dependencies "." "Main Backend"

# Install dependencies for temporal server
print_status "Setting up temporal server..."
install_dependencies "temporal-server" "Temporal Server"

# Check if temporal server proto needs to be generated
if [ ! -d "temporal-server/src/generated" ] || [ "temporal-server/proto/temporal-bridge.proto" -nt "temporal-server/src/generated" ]; then
    print_status "Generating protobuf files for temporal server..."
    cd temporal-server
    npm run proto:generate
    if [ $? -eq 0 ]; then
        print_success "Protobuf files generated"
    else
        print_warning "Proto generation failed, continuing anyway..."
    fi
    cd - > /dev/null
fi

# Check environment files
if [ ! -f "temporal-server/.env" ]; then
    if [ -f "temporal-server/config.example.env" ]; then
        print_warning "Creating .env file for temporal server from example"
        cp temporal-server/config.example.env temporal-server/.env
        print_warning "Please configure temporal-server/.env with your actual values"
    else
        print_error "No environment configuration found for temporal server"
        exit 1
    fi
fi

# Check required ports
BACKEND_PORT=${PORT:-3501}
TEMPORAL_GRPC_PORT=${TEMPORAL_SERVER_PORT:-50051}

print_status "Checking required ports..."

if check_port $BACKEND_PORT; then
    print_error "Backend port $BACKEND_PORT is already in use"
    print_status "Please stop the service using this port or change PORT environment variable"
    exit 1
fi

if check_port $TEMPORAL_GRPC_PORT; then
    print_error "Temporal GRPC port $TEMPORAL_GRPC_PORT is already in use"
    print_status "Please stop the service using this port or change TEMPORAL_SERVER_PORT environment variable"
    exit 1
fi

print_success "All required ports are available"

# Function to cleanup background processes on exit
cleanup() {
    print_status "Shutting down services..."
    if [ ! -z "$TEMPORAL_PID" ]; then
        print_status "Stopping temporal server (PID: $TEMPORAL_PID)"
        kill $TEMPORAL_PID 2>/dev/null
        wait $TEMPORAL_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        print_status "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null
        wait $BACKEND_PID 2>/dev/null
    fi
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start temporal server
print_status "Starting Temporal Server on port $TEMPORAL_GRPC_PORT..."
cd temporal-server
if [ "$NODE_ENV" = "production" ]; then
    npm run build && npm start &
else
    npm run dev &
fi
TEMPORAL_PID=$!
cd - > /dev/null

# Give temporal server time to start
sleep 3

# Check if temporal server is running
if ! kill -0 $TEMPORAL_PID 2>/dev/null; then
    print_error "Temporal server failed to start"
    cleanup
    exit 1
fi

print_success "Temporal server started (PID: $TEMPORAL_PID)"

# Start main backend
print_status "Starting Main Backend on port $BACKEND_PORT..."
if [ "$NODE_ENV" = "production" ]; then
    npm run build && npm start &
else
    npm run dev &
fi
BACKEND_PID=$!

# Give backend time to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend server failed to start"
    cleanup
    exit 1
fi

print_success "Backend server started (PID: $BACKEND_PID)"

# Print status
echo ""
print_success "🎉 Authentik Temporal System is running!"
echo "==========================================="
print_status "Backend Server: http://localhost:$BACKEND_PORT"
print_status "Temporal GRPC Server: localhost:$TEMPORAL_GRPC_PORT"
print_status "Environment: $NODE_ENV"
echo ""
print_status "Backend PID: $BACKEND_PID"
print_status "Temporal Server PID: $TEMPORAL_PID"
echo ""
print_warning "Press Ctrl+C to stop all services"
echo ""

# Monitor both processes
while true; do
    # Check if temporal server is still running
    if ! kill -0 $TEMPORAL_PID 2>/dev/null; then
        print_error "Temporal server stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend server stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    sleep 5
done


