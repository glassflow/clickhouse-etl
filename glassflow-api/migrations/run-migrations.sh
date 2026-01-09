#!/bin/bash
# Migration script for running database migrations
# This script:
# 1. Creates the glassflow database if it doesn't exist
# 2. Runs migrations using golang-migrate

set -e

# Default values
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_DB="${POSTGRES_DB:-glassflow}"
POSTGRES_ADMIN_DB="${POSTGRES_ADMIN_DB:-postgres}"
POSTGRES_SSL_MODE="${POSTGRES_SSL_MODE:-disable}"

MIGRATIONS_PATH="${MIGRATIONS_PATH:-./migrations}"

# Optional: Allow full connection URL to override individual parameters
POSTGRES_CONNECTION_URL="${POSTGRES_CONNECTION_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting database migration...${NC}"

# Step 1: Check if database exists and create if it doesn't
echo -e "${YELLOW}Checking if database '${POSTGRES_DB}' exists...${NC}"

# If password is not set, prompt for it (only in interactive mode), unless using POSTGRES_CONNECTION_URL
if [ -z "${POSTGRES_PASSWORD}" ] && [ -z "${POSTGRES_CONNECTION_URL}" ]; then
    if [ -t 0 ]; then
        # Interactive mode - prompt for password
        echo -e "${YELLOW}PostgreSQL password not set in POSTGRES_PASSWORD environment variable.${NC}"
        echo -e "${YELLOW}Please enter password for user '${POSTGRES_USER}':${NC}"
        read -s POSTGRES_PASSWORD
        echo ""
    else
        # Non-interactive mode (e.g., Kubernetes) - fail if password not set
        echo -e "${RED}Error: POSTGRES_PASSWORD environment variable is required in non-interactive mode${NC}"
        exit 1
    fi
fi

# Build connection strings (after password is set)
if [ -n "${POSTGRES_CONNECTION_URL}" ]; then
    # Use provided connection URL
    echo -e "${GREEN}Using provided POSTGRES_CONNECTION_URL${NC}"
    APP_DSN="${POSTGRES_CONNECTION_URL}"
    # Extract database name from URL for display purposes
    # Match after port number (e.g., :5432/) and capture database name before ? or end
    POSTGRES_DB=$(echo "${POSTGRES_CONNECTION_URL}" | sed 's|.*:[0-9]*/\([^?]*\).*|\1|')
    if [ -z "${POSTGRES_DB}" ]; then
        POSTGRES_DB="glassflow"  # fallback
    fi
else
    # Build connection URL from individual parameters
    APP_DSN="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=${POSTGRES_SSL_MODE}"
fi

# Check if we can connect to the target database
echo -e "${YELLOW}Attempting to connect to database '${POSTGRES_DB}'...${NC}"
if psql "${APP_DSN}" -c "SELECT 1" &>/dev/null; then
    echo -e "${GREEN}Database '${POSTGRES_DB}' exists and is accessible${NC}"
else
    echo -e "${YELLOW}Cannot connect to database '${POSTGRES_DB}'. It may not exist or credentials may be incorrect.${NC}"
    echo -e "${YELLOW}Attempting to create database...${NC}"

    # Build admin connection string for database creation
    if [ -n "${POSTGRES_CONNECTION_URL}" ]; then
        # Replace database name in URL with admin database (usually 'postgres')
        # Match: protocol://credentials@host:port/dbname and optionally ?params
        # Replace only the dbname part while preserving everything else
        ADMIN_DSN=$(echo "${POSTGRES_CONNECTION_URL}" | sed 's|\(.*://.*:[0-9]*/\)[^?]*\(.*\)$|\1'"${POSTGRES_ADMIN_DB}"'\2|')
    else
        # Build admin connection URL from individual parameters
        ADMIN_DSN="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_ADMIN_DB}?sslmode=${POSTGRES_SSL_MODE}"
    fi

    # Try to create the database
    if psql "${ADMIN_DSN}" -c "CREATE DATABASE ${POSTGRES_DB};" 2>/dev/null; then
        echo -e "${GREEN}Database '${POSTGRES_DB}' created successfully${NC}"
    else
        # Database might already exist, or user might not have CREATE DATABASE privileges
        # Try connecting again to confirm
        if psql "${APP_DSN}" -c "SELECT 1" &>/dev/null; then
            echo -e "${GREEN}Database '${POSTGRES_DB}' is now accessible (it may have existed already)${NC}"
        else
            echo -e "${RED}Failed to create or connect to database '${POSTGRES_DB}'${NC}"
            echo -e "${RED}Please ensure:${NC}"
            echo -e "${RED}  1. The database exists, OR${NC}"
            echo -e "${RED}  2. The user has CREATE DATABASE privileges${NC}"
            exit 1
        fi
    fi
fi

# Step 2: Run migrations using golang-migrate
echo -e "${YELLOW}Running migrations on database '${POSTGRES_DB}'...${NC}"

# Check if migrate command exists
if ! command -v migrate &> /dev/null; then
    echo -e "${RED}migrate command not found. Please install golang-migrate:${NC}"
    echo "  brew install golang-migrate"
    echo "  or download from: https://github.com/golang-migrate/migrate/releases"
    exit 1
fi

# Get absolute path to migrations directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure we have a clean absolute path
# Unset any environment variable that might interfere
unset MIGRATIONS_ABS_PATH

# Use SCRIPT_DIR directly (it's already an absolute path from pwd)
MIGRATIONS_ABS_PATH="${SCRIPT_DIR}"

# Remove any file:// prefix if it somehow got in there
MIGRATIONS_ABS_PATH="${MIGRATIONS_ABS_PATH#file://}"
# Also handle case where it might have file:/// (three slashes)
MIGRATIONS_ABS_PATH="${MIGRATIONS_ABS_PATH#file:///}"

# Verify the migrations directory exists
if [ ! -d "${MIGRATIONS_ABS_PATH}" ]; then
    echo -e "${RED}Error: Migrations directory not found: ${MIGRATIONS_ABS_PATH}${NC}"
    exit 1
fi

# Verify migration files exist
if [ ! -f "${MIGRATIONS_ABS_PATH}/000001_initial_schema.up.sql" ]; then
    echo -e "${RED}Error: Migration file not found in ${MIGRATIONS_ABS_PATH}${NC}"
    exit 1
fi

echo -e "${GREEN}Using migrations from: ${MIGRATIONS_ABS_PATH}${NC}"

# Ensure path starts with / (absolute path)
if [[ ! "${MIGRATIONS_ABS_PATH}" =~ ^/ ]]; then
    echo -e "${RED}Error: Expected absolute path, got: ${MIGRATIONS_ABS_PATH}${NC}"
    exit 1
fi

echo -e "${YELLOW}Running migrations from: ${MIGRATIONS_ABS_PATH}${NC}"

# Run migrations
# Note: migrate CLI auto-detects file paths, so we don't need file:// prefix
# Using absolute path directly
migrate -path "${MIGRATIONS_ABS_PATH}" -database "${APP_DSN}" up || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 1 ]; then
        # Exit code 1 might mean "no change" which is OK
        echo -e "${YELLOW}No new migrations to apply${NC}"
    else
        echo -e "${RED}Migration failed with exit code: $EXIT_CODE${NC}"
        exit $EXIT_CODE
    fi
}

echo -e "${GREEN}Migrations completed successfully!${NC}"

