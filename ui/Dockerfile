# Multi-stage Dockerfile with Kerberos/librdkafka support for node-rdkafka
# Switched from Alpine to Debian for better node-rdkafka compatibility

# Stage 1: Build stage with all dependencies
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install build dependencies for node-rdkafka and Kerberos
# Use --no-install-recommends to reduce package size and build time
# Pre-configure krb5 to avoid interactive prompts
RUN echo 'krb5-config krb5-config/default_realm string EXAMPLE.COM' | debconf-set-selections && \
    echo 'krb5-config krb5-config/kerberos_servers string' | debconf-set-selections && \
    echo 'krb5-config krb5-config/admin_server string' | debconf-set-selections && \
    DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    librdkafka-dev \
    libsasl2-dev \
    libsasl2-modules-gssapi-mit \
    krb5-user \
    libssl-dev \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies using npm (which runs build scripts by default)
# We use npm instead of pnpm in Docker because pnpm v9 lockfile disables scripts
# Use --legacy-peer-deps to handle peer dependency conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Production stage with only runtime dependencies
FROM node:20-bullseye-slim

WORKDIR /app

# Install only runtime dependencies for node-rdkafka and Kerberos
# Use --no-install-recommends to reduce image size
# Pre-configure krb5 to avoid interactive prompts
RUN echo 'krb5-config krb5-config/default_realm string EXAMPLE.COM' | debconf-set-selections && \
    echo 'krb5-config krb5-config/kerberos_servers string' | debconf-set-selections && \
    echo 'krb5-config krb5-config/admin_server string' | debconf-set-selections && \
    DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    librdkafka1 \
    libsasl2-2 \
    libsasl2-modules-gssapi-mit \
    krb5-user \
    libssl1.1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files for reference
COPY package.json package-lock.json* ./

# Copy node_modules from builder (includes compiled node-rdkafka)
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
