#!/bin/sh
set -e

# Debug: Print all environment variables for troubleshooting
echo "=== Environment Variables Debug ==="
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"
echo "=================================="

# Set default values for environment variables
# Note: Docker environment variables take precedence over .env.local
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080/api/v1}
export NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}
export NEXT_PUBLIC_PREVIEW_MODE=${NEXT_PUBLIC_PREVIEW_MODE:-false}
export NEXT_PUBLIC_USE_MOCK_API=${NEXT_PUBLIC_USE_MOCK_API:-false}

# Generate runtime configuration for client-side
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_PREVIEW_MODE: \"$NEXT_PUBLIC_PREVIEW_MODE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_USE_MOCK_API: \"$NEXT_PUBLIC_USE_MOCK_API\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Generate runtime configuration for server-side
mkdir -p /app/.next/server/app/api
echo "export const runtimeConfig = {" > /app/.next/server/app/api/config.js
echo "  apiUrl: \"$NEXT_PUBLIC_API_URL\"," >> /app/.next/server/app/api/config.js
echo "  previewMode: \"$NEXT_PUBLIC_PREVIEW_MODE\"" >> /app/.next/server/app/api/config.js
echo "};" >> /app/.next/server/app/api/config.js

# Print configuration for debugging
echo "Runtime configuration generated:"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"

# Print the contents of the generated files for verification
echo "Contents of /app/public/env.js:"
cat /app/public/env.js
echo "Contents of /app/.next/server/app/api/config.js:"
cat /app/.next/server/app/api/config.js

# Set environment variables for the Node.js process
export NODE_ENV=production
export PORT=8080

# Start the application using standard Next.js output
exec pnpm start 