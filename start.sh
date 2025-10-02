#!/bin/bash

# Start script for Authentik Services
# This script kills any running processes on required ports and starts the services
echo "🚀 Starting Authentik Services..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_service() {
    echo -e "${PURPLE}[SERVICE]${NC} $1"
}

print_port() {
    echo -e "${CYAN}[PORT]${NC} $1"
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

# Function to kill process using a specific port
kill_port_process() {
    local port=$1
    local service_name=$2
    
    print_warning "Port $port ($service_name) is in use, searching for process..."

    # Find the PID of the process using the port
    local pid=$(lsof -ti:$port 2>/dev/null)

    if [ ! -z "$pid" ]; then
        print_warning "Found process $pid using port $port"
        
        # Get process information for logging
        local process_info=$(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null)
        if [ ! -z "$process_info" ]; then
            print_warning "Process details: $process_info"
        fi

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

# Function to start a service and capture its output
start_service() {
    local service_name=$1
    local port=$2
    local command=$3
    local working_dir=$4
    
    print_service "Starting $service_name on port $port..."
    
    if [ ! -z "$working_dir" ]; then
        cd "$working_dir"
    fi
    
    # Start the service in background and capture PID
    eval "$command" &
    local service_pid=$!
    
    # Wait a moment for the service to start
    sleep 3
    
    # Check if the service is actually running on the expected port
    if check_port $port; then
        print_success "$service_name is running on port $port (PID: $service_pid)"
        echo "$service_pid" >> /tmp/authentik_pids.txt
        return 0
    else
        print_error "$service_name failed to start on port $port"
        return 1
    fi
}

# Clean up any existing PID file
rm -f /tmp/authentik_pids.txt

# Define services and their ports
declare -A SERVICES=(
    ["Main Server"]="5000"
    ["Form Server"]="3004"
    ["Server Node"]="3502"
    ["Temporal Server"]="50051"
    ["Webhook Server"]="3505"
    ["Cardprocessor Go"]="5004"
)

print_status "Checking and cleaning up ports for all services..."

# Check and kill processes on all required ports
for service in "${!SERVICES[@]}"; do
    port="${SERVICES[$service]}"
    if check_port $port; then
        kill_port_process $port "$service"
    else
        print_success "Port $port ($service) is available"
    fi
done

print_success "All required ports are now available"
echo ""

# Set environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-5000}
export FSERVER_PORT=${FSERVER_PORT:-3004}
export TEMPORAL_SERVER_PORT=${TEMPORAL_SERVER_PORT:-50051}
export WEBHOOK_PORT=${WEBHOOK_PORT:-3505}
export CARDPROCESSOR_PORT=${CARDPROCESSOR_PORT:-5004}

print_status "Environment: $NODE_ENV"
print_status "Starting services..."
echo ""

# Start services
PROJECT_ROOT=$(pwd)

# 1. Start Main Server
start_service "Main Server" "5000" "NODE_ENV=development PORT=5000 npx tsx server/index.ts" "$PROJECT_ROOT"
if [ $? -eq 0 ]; then
    print_port "Main Server: http://localhost:5000"
fi

# 2. Start Form Server
start_service "Form Server" "3004" "NODE_ENV=development npx tsx index.ts" "$PROJECT_ROOT/fserver"
if [ $? -eq 0 ]; then
    print_port "Form Server: http://localhost:3004"
fi

# 3. Start Server Node (if it exists)
if [ -d "$PROJECT_ROOT/server-node" ]; then
    start_service "Server Node" "3502" "NODE_ENV=development npx tsx src/index.ts" "$PROJECT_ROOT/server-node"
    if [ $? -eq 0 ]; then
        print_port "Server Node: http://localhost:3502"
    fi
fi

# 4. Start Temporal Server (if it exists)
if [ -d "$PROJECT_ROOT/temporal-server" ]; then
    start_service "Temporal Server" "50051" "NODE_ENV=development npx tsx src/index.ts" "$PROJECT_ROOT/temporal-server"
    if [ $? -eq 0 ]; then
        print_port "Temporal Server: http://localhost:50051"
    fi
fi

# 5. Start Webhook Server (if it exists)
if [ -d "$PROJECT_ROOT/server-hook" ]; then
    start_service "Webhook Server" "3505" "NODE_ENV=development npx tsx index.ts" "$PROJECT_ROOT/server-hook"
    if [ $? -eq 0 ]; then
        print_port "Webhook Server: http://localhost:3505"
    fi
fi

# 6. Start Cardprocessor Go Server (Birthday cards + Unsubscribe on port 5004)
if [ -d "$PROJECT_ROOT/cardprocessor-go" ]; then
    start_service "Cardprocessor Go" "5004" "go run main.go" "$PROJECT_ROOT/cardprocessor-go"
    if [ $? -eq 0 ]; then
        print_port "Cardprocessor Go: http://localhost:5004 (Birthday cards & Unsubscribe)"
    fi
fi

echo ""
print_success "All available services started successfully!"
echo "=================================="

# Function to cleanup background processes on exit
cleanup() {
    print_status "Shutting down all services..."
    
    if [ -f /tmp/authentik_pids.txt ]; then
        while read pid; do
            if [ ! -z "$pid" ] && kill -0 $pid 2>/dev/null; then
                print_status "Stopping process $pid"
                kill $pid 2>/dev/null
            fi
        done < /tmp/authentik_pids.txt
        rm -f /tmp/authentik_pids.txt
    fi
    
    # Also kill any remaining processes by name
    pkill -f "npx tsx server/index.ts" 2>/dev/null
    pkill -f "npx tsx fserver/index.ts" 2>/dev/null
    pkill -f "npx tsx server-node" 2>/dev/null
    pkill -f "npx tsx temporal-server" 2>/dev/null
    pkill -f "npx tsx server-hook" 2>/dev/null
    
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo ""
print_status "Services are running. Press Ctrl+C to stop all services."
print_status "Active PIDs saved to /tmp/authentik_pids.txt"
echo ""

# Wait for any process to exit or user interrupt
wait
