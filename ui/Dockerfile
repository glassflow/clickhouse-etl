# syntax=docker/dockerfile:1.4

FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first to leverage cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies with caching
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_IN_DOCKER
ENV NEXT_PUBLIC_IN_DOCKER=$NEXT_PUBLIC_IN_DOCKER

# Set Node.js and Next.js optimizations
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_SHARP_PATH=/app/node_modules/sharp

# Build the application
RUN pnpm build

# Create entrypoint script
COPY <<EOF /app/entrypoint.sh
#!/bin/sh
set -e

# Generate runtime config
echo "window.__ENV__ = {" > /app/public/env.js
echo "  NEXT_PUBLIC_API_URL: \"\${NEXT_PUBLIC_API_URL:-http://localhost:8080/api/v1}\"," >> /app/public/env.js
echo "  NEXT_PUBLIC_IN_DOCKER: \"\${NEXT_PUBLIC_IN_DOCKER:-true}\"" >> /app/public/env.js
echo "};" >> /app/public/env.js

# Start the application
exec pnpm start
EOF

RUN chmod +x /app/entrypoint.sh

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["/app/entrypoint.sh"]
