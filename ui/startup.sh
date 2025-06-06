#!/bin/sh
set -e

# Set default values for environment variables
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080/api/v1}
export NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}

# Generate runtime configuration for client-side
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Generate runtime configuration for server-side
mkdir -p /app/.next/server/app/api
echo "export const runtimeConfig = {" > /app/.next/server/app/api/config.js
echo "  apiUrl: \"$NEXT_PUBLIC_API_URL\"," >> /app/.next/server/app/api/config.js
echo "};" >> /app/.next/server/app/api/config.js

# Print configuration for debugging
echo "Runtime configuration generated:"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "NEXT_PUBLIC_IN_DOCKER: $NEXT_PUBLIC_IN_DOCKER"

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