#!/bin/bash

# Start script for Authentik Main Server (Web) only
# Usage: ./startweb.sh [start|stop|restart]

# Check if command is provided
if [ $# -eq 0 ]; then
    echo "🚀 Starting Authentik Main Server..."
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
SERVICE_NAMES=("Main Server")
SERVICE_PORTS=("5002")

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to explicitly handle common EADDRINUSE failures
kill_eaddrinuse_port_5002() {
    local port=5002

    if check_port $port; then
        print_warning "Detected port $port in use (common EADDRINUSE for Main Server)"
        kill_port_process $port "Main Server (npm run dev)"
    else
        print_success "Port $port (Main Server npm run dev) is available"
    fi
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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to list listening PIDs for a port, with tool fallbacks
get_listening_pids() {
    local port=$1
    local pids=""

    if command_exists lsof; then
        pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u)
    elif command_exists fuser; then
        pids=$(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u)
    elif command_exists python3; then
        pids=$(python3 - "$port" <<'PY'
import os
import sys

port = int(sys.argv[1])
hex_port = format(port, '04X')
inodes = set()

for path in ('/proc/net/tcp', '/proc/net/tcp6'):
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            next(f, None)
            for line in f:
                parts = line.split()
                if len(parts) < 10:
                    continue
                local_addr = parts[1]
                state = parts[3]
                inode = parts[9]
                try:
                    _, local_port = local_addr.split(':')
                except ValueError:
                    continue
                if state == '0A' and local_port.upper() == hex_port:
                    inodes.add(inode)
    except FileNotFoundError:
        continue

if not inodes:
    sys.exit(0)

pids = set()
for entry in os.listdir('/proc'):
    if not entry.isdigit():
        continue
    fd_dir = f'/proc/{entry}/fd'
    try:
        for fd in os.listdir(fd_dir):
            fd_path = os.path.join(fd_dir, fd)
            try:
                target = os.readlink(fd_path)
            except OSError:
                continue
            if target.startswith('socket:[') and target.endswith(']'):
                inode = target[8:-1]
                if inode in inodes:
                    pids.add(entry)
                    break
    except OSError:
        continue

for pid in sorted(pids, key=int):
    print(pid)
PY
)
    fi

    if [ -n "$pids" ]; then
        echo "$pids" | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if [ -n "$(get_listening_pids "$port")" ]; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to check if child_pid is the same as or descended from parent_pid
pid_descends_from() {
    local child_pid=$1
    local parent_pid=$2

    if [ "$child_pid" = "$parent_pid" ]; then
        return 0
    fi

    while [ -n "$child_pid" ] && [ "$child_pid" != "1" ]; do
        child_pid=$(ps -o ppid= -p "$child_pid" 2>/dev/null | tr -d ' ')
        if [ -z "$child_pid" ]; then
            break
        fi
        if [ "$child_pid" = "$parent_pid" ]; then
            return 0
        fi
    done

    return 1
}

# Function to kill process using a specific port
kill_port_process() {
    local port=$1
    local service_name=$2
    
    print_warning "Port $port ($service_name) is in use, searching for process..."

    # Find all listening PIDs using the port
    local pids=$(get_listening_pids "$port")

    if [ -n "$pids" ]; then
        print_warning "Found process(es) using port $port: $(echo "$pids" | tr '\n' ' ')"

        while read -r pid; do
            [ -z "$pid" ] && continue
            # Get process information for logging
            local process_info
            process_info=$(ps -p "$pid" -o pid,ppid,cmd --no-headers 2>/dev/null)
            if [ -n "$process_info" ]; then
                print_warning "Process details: $process_info"
            fi

            # Try graceful termination first
            print_warning "Terminating process $pid..."
            kill "$pid" 2>/dev/null
        done <<< "$pids"

        # Wait briefly, then force kill any stragglers
        sleep 2

        local remaining_pids
        remaining_pids=$(get_listening_pids "$port")
        if [ -n "$remaining_pids" ]; then
            while read -r pid; do
                [ -z "$pid" ] && continue
                print_warning "Force-killing process $pid..."
                kill -9 "$pid" 2>/dev/null
            done <<< "$remaining_pids"
            sleep 1
        fi

        # Check if the port is now free
        if check_port "$port"; then
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

    # Ensure the launched process itself is still alive
    if ! kill -0 "$service_pid" 2>/dev/null; then
        print_error "$service_name process exited early (PID: $service_pid)"
        return 1
    fi

    local port_pids
    port_pids=$(get_listening_pids "$port")
    
    # Check if the service (or one of its children) is running on the expected port
    if [ -n "$port_pids" ]; then
        local matched=0
        while read -r port_pid; do
            [ -z "$port_pid" ] && continue
            if pid_descends_from "$port_pid" "$service_pid"; then
                matched=1
                break
            fi
        done <<< "$port_pids"

        if [ "$matched" -eq 0 ]; then
            print_error "$service_name did not bind port $port (port is used by unrelated PID(s): $(echo "$port_pids" | tr '\n' ' '))"
            kill "$service_pid" 2>/dev/null
            return 1
        fi

        print_success "$service_name is running on port $port (PID: $service_pid)"
        echo "$service_pid" >> /tmp/authentik_web_pids.txt
        return 0
    else
        print_error "$service_name failed to start on port $port"
        return 1
    fi
}

# Function to cleanup background processes on exit
cleanup() {
    print_status "Shutting down Main Server..."
    
    if [ -f /tmp/authentik_web_pids.txt ]; then
        while read pid; do
            if [ ! -z "$pid" ] && kill -0 $pid 2>/dev/null; then
                print_status "Stopping process $pid"
                kill $pid 2>/dev/null
            fi
        done < /tmp/authentik_web_pids.txt
        rm -f /tmp/authentik_web_pids.txt
    fi
    
    # Also kill any remaining processes by name
    pkill -f "npx tsx server/index.ts" 2>/dev/null
    
    print_success "Main Server stopped"
    exit 0
}

# Function to stop all services
stop_services() {
    print_status "Stopping Authentik Main Server..."
    
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
    
    print_success "Main Server stopped"
}

# Function to start all services
start_services() {
    echo "🚀 Starting Authentik Main Server..."
    echo "=================================="
    
    # Clean up any existing PID file
    rm -f /tmp/authentik_web_pids.txt

    print_status "Checking and cleaning up ports..."

    # Also guard against existing npm run dev Main Server using 5002
    kill_eaddrinuse_port_5002

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

    print_status "Environment: $NODE_ENV"
    print_status "Starting Main Server..."
    echo ""

    # Start services
    PROJECT_ROOT=$(pwd)

    # 1. Start Main Server (npm run dev equivalent)
    start_service "Main Server" "$PORT" "NODE_ENV=$NODE_ENV PORT=$PORT npx tsx server/index.ts" "$PROJECT_ROOT"
    if [ $? -eq 0 ]; then
        print_port "Main Server: http://localhost:5002"
    else
        print_error "Main Server failed to start cleanly. Try './startweb.sh stop' then './startweb.sh start'."
        return 1
    fi

    echo ""
    print_success "Main Server started successfully!"
    echo "=================================="

    # Set up signal handlers
    trap cleanup SIGINT SIGTERM

    echo ""
    print_status "Main Server is running. Press Ctrl+C to stop."
    print_status "Active PIDs saved to /tmp/authentik_web_pids.txt"
    echo ""

    # Wait for any process to exit or user interrupt
    wait
}

# Main command handling
case "$COMMAND" in
    "start")
        start_services || exit 1
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        print_status "Restarting Main Server..."
        stop_services
        sleep 2
        start_services || exit 1
        ;;
    *)
        echo "Usage: $0 [start|stop|restart]"
        echo "  start     - Start Main Server (kills existing process on port 5002)"
        echo "  stop      - Stop Main Server"
        echo "  restart   - Restart Main Server"
        exit 1
        ;;
esac
