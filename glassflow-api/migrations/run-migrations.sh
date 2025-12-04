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
MIGRATIONS_PATH="${MIGRATIONS_PATH:-./migrations}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting database migration...${NC}"

# Step 1: Check if database exists and create if it doesn't
echo -e "${YELLOW}Checking if database '${POSTGRES_DB}' exists...${NC}"

# If password is not set, prompt for it (only in interactive mode)
if [ -z "${POSTGRES_PASSWORD}" ]; then
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

# Export password for psql commands
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Build connection strings (after password is set)
ADMIN_DSN="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_ADMIN_DB}?sslmode=disable"
APP_DSN="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
DB_EXISTS=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_ADMIN_DB}" -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ]; then
    echo -e "${YELLOW}Database '${POSTGRES_DB}' does not exist. Creating...${NC}"
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_ADMIN_DB}" -c "CREATE DATABASE ${POSTGRES_DB};" || {
        echo -e "${RED}Failed to create database${NC}"
        exit 1
    }
    echo -e "${GREEN}Database '${POSTGRES_DB}' created successfully${NC}"
else
    echo -e "${GREEN}Database '${POSTGRES_DB}' already exists${NC}"
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

