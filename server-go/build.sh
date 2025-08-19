#!/bin/bash

set -e

echo "🔨 Building Temporal Email Worker System..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -f ./worker ./server ./postmark-worker

# Build worker
echo "🏗️  Building worker..."
go build -o worker ./cmd/worker/main.go

# Build server
echo "🏗️  Building server..."
go build -o server ./cmd/server/main.go

# Build Postmark worker
echo "🏗️  Building Postmark worker..."
go build -o postmark-worker ./cmd/postmark-worker/main.go

echo "✅ Build completed successfully!"
echo ""
echo "🚀 Usage:"
echo "  ./worker                - Start Resend Temporal worker"
echo "  ./server                - Start HTTP API server"
echo "  ./postmark-worker       - Start Postmark Temporal worker"
echo "  ./start-postmark.sh     - Start Postmark worker + server with config"
echo ""
echo "📋 Environment Variables (optional):"
echo "  CONFIG_FILE             - Path to config file (default: config/config.yaml)"
echo "  TEMPORAL_HOST           - Temporal server address (default: 172.18.0.4:7233)"
echo "  RESEND_API_KEY          - Resend API key for sending emails"
echo "  POSTMARK_API_KEY        - Postmark API key for sending emails"
echo "  LOG_LEVEL               - Logging level (debug, info, warn, error)"
echo ""
