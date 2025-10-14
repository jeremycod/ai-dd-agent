#!/bin/bash

# Load environment variables from .env file
if [ -f src/.env ]; then
    set -a
    source src/.env
    set +a
    echo "✅ Loaded environment variables from src/.env"
else
    echo "⚠️ No .env file found in src/ directory"
fi

# Set additional environment variables
export CAPTURE_API_RESPONSES=true
export PORT=3005

echo "🚀 Starting AI Diagnostic Assistant with API capture enabled..."
echo "📊 API capture: ENABLED"
echo "🔗 Server will run on: http://localhost:3005"
echo "💡 Using server.ts with API capture enabled"

# Change to project directory and run
cd "$(dirname "$0")"
npm run dev:capture