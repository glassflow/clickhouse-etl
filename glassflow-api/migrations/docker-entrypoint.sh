#!/bin/sh
# Migration entrypoint script
# This script validates the connection URL and runs database migrations

set -e

# Validate POSTGRES_CONNECTION_URL is set
if [ -z "${POSTGRES_CONNECTION_URL}" ]; then
    echo "ERROR: POSTGRES_CONNECTION_URL environment variable is required"
    exit 1
fi

echo "Starting database migration..."
echo ""

# Test database connection
echo "Testing database connection..."
if psql "${POSTGRES_CONNECTION_URL}" -c "SELECT 1" >/dev/null 2>&1; then
    echo "Database connection successful"
    echo ""
else
    echo "ERROR: Failed to connect to database"
    echo "The database should already exist:"
    echo "  - For internal PostgreSQL: Created automatically by the PostgreSQL chart"
    echo "  - For external PostgreSQL: Should be pre-created before running migrations"
    echo ""
    echo "Connection URL format: postgresql://username:password@host:port/database?sslmode={sslmode=disable|allow|prefer|require}"
    exit 1
fi

# Run migrations
echo "Running migrations..."
migrate -path /migrations -database "${POSTGRES_CONNECTION_URL}" up || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 1 ]; then
        # Exit code 1 might mean "no change" which is OK
        echo "No new migrations to apply"
    else
        echo "ERROR: Migration failed with exit code: $EXIT_CODE"
        exit $EXIT_CODE
    fi
}

echo ""
echo "Migrations completed successfully!"
