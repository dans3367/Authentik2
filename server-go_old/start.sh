#!/bin/bash

set -e

# Unified startup script that runs the Temporal worker and the HTTP API server
# via start-all.sh (which also builds the correct binaries under cmd/).

cd "$(dirname "$0")"

echo "🚀 Starting Email Tracking system (Temporal server + worker)"

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📋 Loading environment variables from .env file..."
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

# Ensure CONFIG_FILE defaults to our repo config
export CONFIG_FILE=${CONFIG_FILE:-"$(pwd)/config/config.yaml"}

echo "📋 Using CONFIG_FILE=$CONFIG_FILE"
echo "ℹ️  Delegating to start-all.sh"

exec ./start-all.sh