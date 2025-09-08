#!/bin/bash

# Start script for Temporal service
echo "🚀 Starting Authentik Temporal Service..."

# Set environment variables
export PORT=3502
export NODE_ENV=development
export TEMPORAL_SERVER_URL=100.125.36.104:7233
export TEMPORAL_NAMESPACE=default
export TEMPORAL_TASK_QUEUE=authentik-tasks
export DATABASE_URL=postgresql://localhost:5432/authentik
export BACKEND_URL=http://localhost:5000

# Start the service
echo "📡 Connecting to Temporal at $TEMPORAL_SERVER_URL"
echo "🏃 Starting server on port $PORT"

npm run dev


