#!/bin/bash

# kill.sh — Force-kill ALL Authentik services on their known ports
# Ports: 5002 (Express), 5173 (Vite), 3505 (Webhook), 5003 (Bounce Webhook), 3001 (Form Server)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PORTS=(5002 5173 3505 5003 3001)
LABELS=("Express Server" "Vite Dev Server" "Webhook Server" "Bounce Webhook Server" "Form Server")

force_kill_port() {
    local port=$1
    local label=$2
    local pids

    pids=$(lsof -ti :"$port" 2>/dev/null)
    if [ -z "$pids" ]; then
        echo -e "${GREEN}[OK]${NC}    Port $port ($label) — already free"
        return 0
    fi

    echo -e "${YELLOW}[KILL]${NC}  Port $port ($label) — PIDs: $pids"
    # SIGKILL — no mercy
    echo "$pids" | xargs kill -9 2>/dev/null
    return 1
}

echo "============================================"
echo "  Authentik — Force Kill All Services"
echo "============================================"
echo ""

# --- Pass 1: kill everything ------------------------------------------------
needs_recheck=false
for i in "${!PORTS[@]}"; do
    force_kill_port "${PORTS[$i]}" "${LABELS[$i]}" || needs_recheck=true
done

# --- Wait & recheck ---------------------------------------------------------
if $needs_recheck; then
    echo ""
    echo -e "${YELLOW}[WAIT]${NC}  Waiting 3 seconds for processes to exit..."
    sleep 3

    echo ""
    echo "--- Recheck ---"
    all_clear=true
    for i in "${!PORTS[@]}"; do
        pids=$(lsof -ti :"${PORTS[$i]}" 2>/dev/null)
        if [ -n "$pids" ]; then
            echo -e "${RED}[STUCK]${NC} Port ${PORTS[$i]} (${LABELS[$i]}) still occupied — PIDs: $pids — retrying kill -9"
            echo "$pids" | xargs kill -9 2>/dev/null
            all_clear=false
        else
            echo -e "${GREEN}[OK]${NC}    Port ${PORTS[$i]} (${LABELS[$i]}) — free"
        fi
    done

    # --- Final verification after second kill --------------------------------
    if ! $all_clear; then
        echo ""
        echo -e "${YELLOW}[WAIT]${NC}  Waiting 2 more seconds..."
        sleep 2

        echo ""
        echo "--- Final verification ---"
        for i in "${!PORTS[@]}"; do
            pids=$(lsof -ti :"${PORTS[$i]}" 2>/dev/null)
            if [ -n "$pids" ]; then
                echo -e "${RED}[FAIL]${NC} Port ${PORTS[$i]} (${LABELS[$i]}) STILL alive — PIDs: $pids — manual intervention needed"
            else
                echo -e "${GREEN}[OK]${NC}    Port ${PORTS[$i]} (${LABELS[$i]}) — free"
            fi
        done
    fi
fi

echo ""
echo -e "${GREEN}Done.${NC}"
