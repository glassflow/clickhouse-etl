# Multi-stage Dockerfile for Next.js UI with Standalone Output
# Optimized for minimal image size and faster builds
# syntax=docker/dockerfile:1.4

# ============================================
# Stage 1: Dependencies
# Only install dependencies (cached separately from source code)
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc6-compat for native module compatibility
RUN apk add --no-cache libc6-compat

# Install pnpm with pinned version for reproducibility and caching
RUN npm install -g pnpm@10.28.2

# Copy only dependency files for optimal layer caching
# This layer is cached unless package.json or pnpm-lock.yaml changes
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (needed for build)
# Use BuildKit cache mounts to cache pnpm store and metadata
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# Build the Next.js application
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install libc6-compat for native modules during build
RUN apk add --no-cache libc6-compat

# Install pnpm (pinned version)
RUN npm install -g pnpm@10.28.2

# Copy node_modules from deps stage (avoid reinstalling)
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Set build-time environment variables
# IMPORTANT: NEXT_PUBLIC_API_URL is NOT set here - it must be provided at runtime
# via environment variables. The startup.sh script and config.ts getters handle
# runtime configuration. Setting it here would bake it into the build.
ARG NEXT_PUBLIC_PROFILE_ROUTE=/api/auth/me
ARG NEXT_PUBLIC_AUTH0_ENABLED=true
ARG NEXT_PUBLIC_FILTERS_ENABLED=true
ENV NEXT_PUBLIC_PROFILE_ROUTE=${NEXT_PUBLIC_PROFILE_ROUTE}
ENV NEXT_PUBLIC_AUTH0_ENABLED=${NEXT_PUBLIC_AUTH0_ENABLED}
ENV NEXT_PUBLIC_FILTERS_ENABLED=${NEXT_PUBLIC_FILTERS_ENABLED}

# Build Next.js application with standalone output
# This creates:
# - .next/standalone/ (minimal server with only traced runtime dependencies)
# - .next/static/ (static assets - must be copied separately)
# - public/ (public assets)
# Add cache mount for Next.js incremental cache
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    pnpm run build

# ============================================
# Stage 3: Production Runtime
# Minimal production image with only runtime dependencies
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_PUBLIC_IN_DOCKER=true

# Create non-root user for security best practices
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes minimal traced dependencies)
# This is ~100-200MB instead of ~800MB-1GB with full node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files separately (required for standalone mode)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public folder (static assets)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy startup script for runtime environment variable injection
COPY --chown=nextjs:nodejs startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Switch to non-root user
USER nextjs

EXPOSE 8080

# Use startup script to handle environment variables and start server
CMD ["/app/startup.sh"]
