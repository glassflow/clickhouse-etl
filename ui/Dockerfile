# Multi-stage Dockerfile for Next.js UI
# Uses kafka-gateway for Kerberos authentication, no native dependencies needed

# Stage 1: Build stage
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies using npm
# Use --legacy-peer-deps to handle peer dependency conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Production stage
FROM node:20-bullseye-slim

WORKDIR /app

# Install only ca-certificates for HTTPS support
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

ENV NODE_ENV=production

# Copy package files for reference
COPY package.json package-lock.json* ./

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
