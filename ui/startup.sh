#!/bin/sh
set -e

# Debug: Print all environment variables for troubleshooting
echo "=== Environment Variables Debug ==="
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"
echo "NEXT_PUBLIC_ANALYTICS_ENABLED: $NEXT_PUBLIC_ANALYTICS_ENABLED"
echo "NEXT_PUBLIC_DEMO_MODE: $NEXT_PUBLIC_DEMO_MODE"
echo "NEXT_PUBLIC_AUTH0_ENABLED: $NEXT_PUBLIC_AUTH0_ENABLED"
echo "NEXT_PUBLIC_PROFILE_ROUTE: $NEXT_PUBLIC_PROFILE_ROUTE"
echo "=================================="

# Set default values for environment variables
# Note: Docker environment variables take precedence over .env.local
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
export NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}
export NEXT_PUBLIC_PREVIEW_MODE=${NEXT_PUBLIC_PREVIEW_MODE:-false}
export NEXT_PUBLIC_USE_MOCK_API=${NEXT_PUBLIC_USE_MOCK_API:-false}
export NEXT_PUBLIC_ANALYTICS_ENABLED=${NEXT_PUBLIC_ANALYTICS_ENABLED:-true}
export NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE:-false}
export NEXT_PUBLIC_AUTH0_ENABLED=${NEXT_PUBLIC_AUTH0_ENABLED:-false}
export NEXT_PUBLIC_PROFILE_ROUTE=${NEXT_PUBLIC_PROFILE_ROUTE:-/api/auth/me}

# Generate runtime configuration for client-side
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_PREVIEW_MODE: \"$NEXT_PUBLIC_PREVIEW_MODE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_USE_MOCK_API: \"$NEXT_PUBLIC_USE_MOCK_API\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_ANALYTICS_ENABLED: \"$NEXT_PUBLIC_ANALYTICS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_DEMO_MODE: \"$NEXT_PUBLIC_DEMO_MODE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_AUTH0_ENABLED: \"$NEXT_PUBLIC_AUTH0_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_PROFILE_ROUTE: \"$NEXT_PUBLIC_PROFILE_ROUTE\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Generate runtime configuration for server-side
# Apply the same ensureApiV1Suffix logic here that we have in TypeScript
mkdir -p /app/.next/server/app/api

# Function to ensure /api/v1 suffix
ensure_api_v1_suffix() {
  local url="$1"
  if [ -z "$url" ]; then
    echo "$url"
    return
  fi

  # Remove trailing slash
  url=$(echo "$url" | sed 's/\/$//')

  # Check if it already has /api/v1 suffix
  if echo "$url" | grep -q '/api/v1$'; then
    echo "$url"
  else
    echo "$url/api/v1"
  fi
}

# Apply the suffix logic to the API URL
PROCESSED_API_URL=$(ensure_api_v1_suffix "$NEXT_PUBLIC_API_URL")

echo "export const runtimeConfig = {" > /app/.next/server/app/api/config.js
echo "  apiUrl: \"$PROCESSED_API_URL\"," >> /app/.next/server/app/api/config.js
echo "  previewMode: \"$NEXT_PUBLIC_PREVIEW_MODE\"," >> /app/.next/server/app/api/config.js
echo "  analyticsEnabled: \"$NEXT_PUBLIC_ANALYTICS_ENABLED\"" >> /app/.next/server/app/api/config.js
echo "};" >> /app/.next/server/app/api/config.js

echo "🔧 Processed API URL: $NEXT_PUBLIC_API_URL -> $PROCESSED_API_URL"

# Print configuration for debugging
echo "Runtime configuration generated:"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"
echo "NEXT_PUBLIC_ANALYTICS_ENABLED: $NEXT_PUBLIC_ANALYTICS_ENABLED"
echo "NEXT_PUBLIC_DEMO_MODE: $NEXT_PUBLIC_DEMO_MODE"
echo "NEXT_PUBLIC_AUTH0_ENABLED: $NEXT_PUBLIC_AUTH0_ENABLED"
echo "NEXT_PUBLIC_PROFILE_ROUTE: $NEXT_PUBLIC_PROFILE_ROUTE"

# Print the contents of the generated files for verification
echo "Contents of /app/public/env.js:"
cat /app/public/env.js
echo "Contents of /app/.next/server/app/api/config.js:"
cat /app/.next/server/app/api/config.js

# Set environment variables for the Node.js process
export NODE_ENV=production
export PORT=8080

# Start the application using standard Next.js output
exec npm start 