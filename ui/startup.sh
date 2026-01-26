#!/bin/sh
set -e

# Debug: Print all environment variables for troubleshooting
echo "=== Environment Variables Debug (Before Export) ==="
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"
echo "NEXT_PUBLIC_ANALYTICS_ENABLED: $NEXT_PUBLIC_ANALYTICS_ENABLED"
echo "NEXT_PUBLIC_FILTERS_ENABLED: $NEXT_PUBLIC_FILTERS_ENABLED"
echo "NEXT_PUBLIC_TRANSFORMATIONS_ENABLED: $NEXT_PUBLIC_TRANSFORMATIONS_ENABLED"
echo "NEXT_PUBLIC_DEMO_MODE: $NEXT_PUBLIC_DEMO_MODE"
echo "NEXT_PUBLIC_DASHBOARD: $NEXT_PUBLIC_DASHBOARD"
echo "NEXT_PUBLIC_AUTH0_ENABLED: $NEXT_PUBLIC_AUTH0_ENABLED"
echo "NEXT_PUBLIC_PROFILE_ROUTE: $NEXT_PUBLIC_PROFILE_ROUTE"
echo "NEXT_PUBLIC_OTEL_LOGS_ENABLED: $NEXT_PUBLIC_OTEL_LOGS_ENABLED"
echo "NEXT_PUBLIC_OTEL_METRICS_ENABLED: $NEXT_PUBLIC_OTEL_METRICS_ENABLED"
echo "NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT: $NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT"
echo ""
echo "=== Server-Side Auth0 Variables (Before Export) ==="
echo "AUTH0_ENABLED: $AUTH0_ENABLED"
echo "AUTH0_DOMAIN: $AUTH0_DOMAIN"
echo "AUTH0_ISSUER_BASE_URL: $AUTH0_ISSUER_BASE_URL"
echo "AUTH0_CLIENT_ID: $AUTH0_CLIENT_ID"
echo "APP_BASE_URL: $APP_BASE_URL"
echo "AUTH0_SECRET: ${AUTH0_SECRET:0:10}..." # Only show first 10 chars for security
echo "AUTH0_CLIENT_SECRET: ${AUTH0_CLIENT_SECRET:0:10}..." # Only show first 10 chars for security
echo "===================================================="

# Set default values for environment variables
# Note: Docker environment variables take precedence over .env.local
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
# API_URL is the non-prefixed version for server-side code (not inlined by Next.js)
# This ensures server-side API routes can read the URL at runtime
export API_URL=${NEXT_PUBLIC_API_URL}
export NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}
export NEXT_PUBLIC_PREVIEW_MODE=${NEXT_PUBLIC_PREVIEW_MODE:-false}
export NEXT_PUBLIC_USE_MOCK_API=${NEXT_PUBLIC_USE_MOCK_API:-false}
export NEXT_PUBLIC_ANALYTICS_ENABLED=${NEXT_PUBLIC_ANALYTICS_ENABLED:-true}
export NEXT_PUBLIC_FILTERS_ENABLED=${NEXT_PUBLIC_FILTERS_ENABLED:-false}
export NEXT_PUBLIC_TRANSFORMATIONS_ENABLED=${NEXT_PUBLIC_TRANSFORMATIONS_ENABLED:-false}
export NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE:-false}
export NEXT_PUBLIC_DASHBOARD=${NEXT_PUBLIC_DASHBOARD:-}
# NOTE: NEXT_PUBLIC_AUTH0_ENABLED is set below to match AUTH0_ENABLED (single source of truth)
export NEXT_PUBLIC_PROFILE_ROUTE=${NEXT_PUBLIC_PROFILE_ROUTE:-/api/auth/me}
# OpenTelemetry Configuration
export NEXT_PUBLIC_OTEL_LOGS_ENABLED=${NEXT_PUBLIC_OTEL_LOGS_ENABLED:-false}
export NEXT_PUBLIC_OTEL_METRICS_ENABLED=${NEXT_PUBLIC_OTEL_METRICS_ENABLED:-false}
export NEXT_PUBLIC_OTEL_SERVICE_NAME=${NEXT_PUBLIC_OTEL_SERVICE_NAME:-glassflow-ui}
export NEXT_PUBLIC_OTEL_SERVICE_VERSION=${NEXT_PUBLIC_OTEL_SERVICE_VERSION:-dev}
export NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE=${NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE:-}
export NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID=${NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID:-}
export NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=${NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}
export NEXT_PUBLIC_LOG_LEVEL=${NEXT_PUBLIC_LOG_LEVEL:-info}

# Export server-side only Auth0 variables (not prefixed with NEXT_PUBLIC_)
# These are used by auth-config.server.ts and should be available at runtime
export AUTH0_ENABLED=${AUTH0_ENABLED:-false}
export AUTH0_SECRET=${AUTH0_SECRET:-}
export AUTH0_DOMAIN=${AUTH0_DOMAIN:-}
export AUTH0_ISSUER_BASE_URL=${AUTH0_ISSUER_BASE_URL:-}
export AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID:-}
export AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET:-}
export APP_BASE_URL=${APP_BASE_URL:-http://localhost:8080}

# CRITICAL: Sync NEXT_PUBLIC_AUTH0_ENABLED to match AUTH0_ENABLED
# This ensures client-side and server-side auth state are always in agreement
# AUTH0_ENABLED is the single source of truth for authentication state
export NEXT_PUBLIC_AUTH0_ENABLED=${AUTH0_ENABLED}

# Generate runtime configuration for client-side
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_PREVIEW_MODE: \"$NEXT_PUBLIC_PREVIEW_MODE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_USE_MOCK_API: \"$NEXT_PUBLIC_USE_MOCK_API\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_ANALYTICS_ENABLED: \"$NEXT_PUBLIC_ANALYTICS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_FILTERS_ENABLED: \"$NEXT_PUBLIC_FILTERS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_TRANSFORMATIONS_ENABLED: \"$NEXT_PUBLIC_TRANSFORMATIONS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_DEMO_MODE: \"$NEXT_PUBLIC_DEMO_MODE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_DASHBOARD: \"$NEXT_PUBLIC_DASHBOARD\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_AUTH0_ENABLED: \"$NEXT_PUBLIC_AUTH0_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_PROFILE_ROUTE: \"$NEXT_PUBLIC_PROFILE_ROUTE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_LOGS_ENABLED: \"$NEXT_PUBLIC_OTEL_LOGS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_METRICS_ENABLED: \"$NEXT_PUBLIC_OTEL_METRICS_ENABLED\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_SERVICE_NAME: \"$NEXT_PUBLIC_OTEL_SERVICE_NAME\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_SERVICE_VERSION: \"$NEXT_PUBLIC_OTEL_SERVICE_VERSION\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE: \"$NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID: \"$NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT: \"$NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_LOG_LEVEL: \"$NEXT_PUBLIC_LOG_LEVEL\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Generate runtime configuration for server-side
# Apply the same ensureApiV1Suffix logic here that we have in TypeScript
mkdir -p /app/.next/server/app/api
mkdir -p /app/.next/server/app/ui-api

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

# Create config at both locations (api and ui-api) for compatibility
for config_path in /app/.next/server/app/api/config.js /app/.next/server/app/ui-api/config.js; do
  echo "export const runtimeConfig = {" > "$config_path"
  echo "  apiUrl: \"$PROCESSED_API_URL\"," >> "$config_path"
  echo "  previewMode: \"$NEXT_PUBLIC_PREVIEW_MODE\"," >> "$config_path"
  echo "  analyticsEnabled: \"$NEXT_PUBLIC_ANALYTICS_ENABLED\"" >> "$config_path"
  echo "};" >> "$config_path"
done

echo "🔧 Processed API URL: $NEXT_PUBLIC_API_URL -> $PROCESSED_API_URL"

# Print configuration for debugging
echo "=== Runtime Configuration (After Export) ==="
echo "API_URL: $API_URL"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"
echo "NEXT_PUBLIC_PREVIEW_MODE: $NEXT_PUBLIC_PREVIEW_MODE"
echo "NEXT_PUBLIC_USE_MOCK_API: $NEXT_PUBLIC_USE_MOCK_API"
echo "NEXT_PUBLIC_ANALYTICS_ENABLED: $NEXT_PUBLIC_ANALYTICS_ENABLED"
echo "NEXT_PUBLIC_FILTERS_ENABLED: $NEXT_PUBLIC_FILTERS_ENABLED"
echo "NEXT_PUBLIC_TRANSFORMATIONS_ENABLED: $NEXT_PUBLIC_TRANSFORMATIONS_ENABLED"
echo "NEXT_PUBLIC_DEMO_MODE: $NEXT_PUBLIC_DEMO_MODE"
echo "NEXT_PUBLIC_DASHBOARD: $NEXT_PUBLIC_DASHBOARD"
echo "NEXT_PUBLIC_AUTH0_ENABLED: $NEXT_PUBLIC_AUTH0_ENABLED"
echo "NEXT_PUBLIC_PROFILE_ROUTE: $NEXT_PUBLIC_PROFILE_ROUTE"
echo "NEXT_PUBLIC_OTEL_LOGS_ENABLED: $NEXT_PUBLIC_OTEL_LOGS_ENABLED"
echo "NEXT_PUBLIC_OTEL_METRICS_ENABLED: $NEXT_PUBLIC_OTEL_METRICS_ENABLED"
echo "NEXT_PUBLIC_OTEL_SERVICE_NAME: $NEXT_PUBLIC_OTEL_SERVICE_NAME"
echo "NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT: $NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT"
echo ""
echo "=== Server-Side Auth0 Variables (After Export) ==="
echo "AUTH0_ENABLED: $AUTH0_ENABLED"
echo "AUTH0_DOMAIN: $AUTH0_DOMAIN"
echo "AUTH0_ISSUER_BASE_URL: $AUTH0_ISSUER_BASE_URL"
echo "AUTH0_CLIENT_ID: $AUTH0_CLIENT_ID"
echo "APP_BASE_URL: $APP_BASE_URL"
echo "=============================================="

# Print the contents of the generated files for verification
echo "Contents of /app/public/env.js:"
cat /app/public/env.js
echo "Contents of /app/.next/server/app/api/config.js:"
cat /app/.next/server/app/api/config.js
echo "Contents of /app/.next/server/app/ui-api/config.js:"
cat /app/.next/server/app/ui-api/config.js

# Set environment variables for the Node.js process
export NODE_ENV=production
export PORT=8080

# Start the application using standard Next.js output
exec npm start 