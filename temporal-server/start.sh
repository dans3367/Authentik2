#!/bin/bash

# Start script for Authentik Temporal Server

echo "🚀 Starting Authentik Temporal Server..."

# Check if .env file exists, if not copy from example
if [ ! -f .env ]; then
    if [ -f config.example.env ]; then
        echo "📋 Creating .env file from example..."
        cp config.example.env .env
        echo "⚠️  Please configure .env file with your actual values"
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate protobuf files
echo "🔧 Generating protobuf files..."
npm run proto:generate

# Check if this is development or production
if [ "$NODE_ENV" = "production" ]; then
    echo "🏭 Building for production..."
    npm run build
    echo "🚀 Starting production server..."
    npm start
else
    echo "🔧 Starting development server..."
    npm run dev
fi


