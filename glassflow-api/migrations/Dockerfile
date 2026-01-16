FROM alpine:3.20

# Install golang-migrate and postgresql-client
RUN apk add --no-cache curl postgresql-client && \
    MIGRATE_VERSION="v4.19.1" && \
    ARCH="$(uname -m)" && \
    case "$ARCH" in \
        x86_64) ARCH="amd64" ;; \
        aarch64|arm64) ARCH="arm64" ;; \
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;; \
    esac && \
    curl -L "https://github.com/golang-migrate/migrate/releases/download/${MIGRATE_VERSION}/migrate.linux-${ARCH}.tar.gz" | tar xvz && \
    mv migrate /usr/local/bin/migrate && \
    chmod +x /usr/local/bin/migrate && \
    rm -rf /tmp/*

# Copy migration SQL files (only up migrations)
COPY *.up.sql /migrations/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set working directory
WORKDIR /migrations

ENTRYPOINT ["/docker-entrypoint.sh"]
