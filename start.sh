#!/bin/bash

# Start script for Authentik Services
# Usage: ./start.sh [start|stop|restart]
# Starts the Main Server (npm run dev) and the Webhook Server

# Check if command is provided
if [ $# -eq 0 ]; then
    echo "🚀 Starting Authentik Services..."
    echo "=================================="
    COMMAND="start"
else
    COMMAND="$1"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Define services and their ports (global scope for stop_services)
SERVICE_NAMES=("Main Server" "Webhook Server")
SERVICE_PORTS=("5002" "3505")

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
    pkill -f "npx tsx server-hook" 2>/dev/null
    
    print_success "All services stopped"
    exit 0
}

# Function to stop all services
stop_services() {
    print_status "Stopping all Authentik services..."
    
    # Kill processes on the defined ports
    for ((i=0; i<${#SERVICE_NAMES[@]}; i++)); do
        service="${SERVICE_NAMES[$i]}"
        port="${SERVICE_PORTS[$i]}"
        if check_port $port; then
            kill_port_process $port "$service"
        else
            print_success "Port $port ($service) is already free"
        fi
    done
    
    # Also kill by process names
    pkill -f "npx tsx server/index.ts" 2>/dev/null
    pkill -f "npx tsx server-hook" 2>/dev/null
    
    print_success "All services stopped"
}

# Function to start all services
start_services() {
    echo "🚀 Starting Authentik Services..."
    echo "=================================="
    
    # Clean up any existing PID file
    rm -f /tmp/authentik_pids.txt

    print_status "Checking and cleaning up ports for all services..."

    # Check and kill processes on all required ports BEFORE starting
    for ((i=0; i<${#SERVICE_NAMES[@]}; i++)); do
        service="${SERVICE_NAMES[$i]}"
        port="${SERVICE_PORTS[$i]}"
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
    export PORT=${PORT:-5002}
    export WEBHOOK_PORT=${WEBHOOK_PORT:-3505}

    print_status "Environment: $NODE_ENV"
    print_status "Starting services..."
    echo ""

    # Start services
    PROJECT_ROOT=$(pwd)

    # 1. Start Main Server (npm run dev equivalent)
    start_service "Main Server" "$PORT" "NODE_ENV=$NODE_ENV PORT=$PORT npx tsx server/index.ts" "$PROJECT_ROOT"
    if [ $? -eq 0 ]; then
        print_port "Main Server: http://localhost:5002"
    fi

    # 2. Start Webhook Server (for Resend webhooks)
    if [ -d "$PROJECT_ROOT/server-hook" ]; then
        start_service "Webhook Server" "$WEBHOOK_PORT" "NODE_ENV=$NODE_ENV WEBHOOK_PORT=$WEBHOOK_PORT npx tsx index.ts" "$PROJECT_ROOT/server-hook"
        if [ $? -eq 0 ]; then
            print_port "Webhook Server: http://localhost:3505"
        fi
    else
        print_warning "Webhook Server directory (server-hook) not found, skipping..."
    fi

    echo ""
    print_success "All available services started successfully!"
    echo "=================================="

    # Set up signal handlers
    trap cleanup SIGINT SIGTERM

    echo ""
    print_status "Services are running. Press Ctrl+C to stop all services."
    print_status "Active PIDs saved to /tmp/authentik_pids.txt"
    echo ""

    # Wait for any process to exit or user interrupt
    wait
}

# Main command handling
case "$COMMAND" in
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        print_status "Restarting services..."
        stop_services
        sleep 2
        start_services
        ;;
    *)
        echo "Usage: $0 [start|stop|restart]"
        echo "  start   - Start all services (kills existing processes on ports 5002 and 3505)"
        echo "  stop    - Stop all running services"
        echo "  restart - Restart all services"
        exit 1
        ;;
esac
