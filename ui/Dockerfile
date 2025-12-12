# Multi-stage Dockerfile for Next.js UI
# Uses kafka-gateway for Kerberos authentication, no native dependencies needed
# Alpine-based for minimal image size (~70MB smaller than Debian)

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm and compatibility layer for Next.js
RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set build-time environment variables
# IMPORTANT: NEXT_PUBLIC_API_URL is NOT set here - it must be provided at runtime
# via environment variables. The startup.sh script and config.ts getters handle
# runtime configuration. Setting it here would bake it into the build.
#
# For Auth0 and other build-time flags, provide via --build-arg if needed:
#   docker build --build-arg NEXT_PUBLIC_AUTH0_ENABLED=true ...
ARG NEXT_PUBLIC_PROFILE_ROUTE=/api/auth/me
ARG NEXT_PUBLIC_AUTH0_ENABLED=true
ARG NEXT_PUBLIC_FILTERS_ENABLED=false
ENV NEXT_PUBLIC_PROFILE_ROUTE=${NEXT_PUBLIC_PROFILE_ROUTE}
ENV NEXT_PUBLIC_AUTH0_ENABLED=${NEXT_PUBLIC_AUTH0_ENABLED}
ENV NEXT_PUBLIC_FILTERS_ENABLED=${NEXT_PUBLIC_FILTERS_ENABLED}

# Build the Next.js application
RUN pnpm run build

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Install only ca-certificates for HTTPS support (already included in alpine)
RUN apk add --no-cache ca-certificates

ENV NODE_ENV=production

# Install pnpm in production stage
RUN npm install -g pnpm@latest

# Copy package files for reference
COPY package.json pnpm-lock.yaml* ./

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/server.js ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_PUBLIC_IN_DOCKER=true

# Expose the port
EXPOSE 8080

# Copy and make startup script executable
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Use startup script to handle environment variables and start the server
CMD ["/app/startup.sh"]
