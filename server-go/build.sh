#!/bin/bash

set -e

echo "🔨 Building Temporal Email Worker System..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -f ./worker ./server

# Build worker
echo "🏗️  Building worker..."
go build -o worker ./cmd/worker/main.go

# Build server
echo "🏗️  Building server..."
go build -o server ./cmd/server/main.go

echo "✅ Build completed successfully!"
echo ""
echo "🚀 Usage:"
echo "  ./worker                - Start Temporal worker"
echo "  ./server                - Start HTTP API server"
echo ""
echo "📋 Environment Variables (optional):"
echo "  CONFIG_FILE             - Path to config file (default: config/config.yaml)"
echo "  TEMPORAL_HOST           - Temporal server address (default: 172.18.0.4:7233)"
echo "  RESEND_API_KEY          - Resend API key for sending emails"
echo "  LOG_LEVEL               - Logging level (debug, info, warn, error)"
echo ""
