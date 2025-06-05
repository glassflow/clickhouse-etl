#!/bin/sh
set -e

# Set default values if not provided
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080/api/v1}
export NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}

# Generate runtime config for client-side
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Print environment variables for debugging
echo "Starting with environment variables:"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"

# Set environment variables for the Node.js process
export NODE_ENV=production
export PORT=3000

# Start the application using the standalone server
exec node .next/standalone/server.js 