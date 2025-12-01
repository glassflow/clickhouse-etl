# Database Migrations

This directory contains database migration files for the GlassFlow ETL PostgreSQL database.

## Migration Files

- `000001_initial_schema.up.sql` - Creates the initial database schema
- `000001_initial_schema.down.sql` - Rollback script (currently empty)

## Running Migrations Locally

### Prerequisites

1. **Install golang-migrate**:
   ```bash
   # macOS
   brew install golang-migrate
   
   # Linux
   curl -L https://github.com/golang-migrate/migrate/releases/download/v4.19.1/migrate.linux-amd64.tar.gz | tar xvz
   sudo mv migrate /usr/local/bin/migrate
   
   # Or download from: https://github.com/golang-migrate/migrate/releases
   ```

2. **PostgreSQL running** (local or remote)

### Using the Migration Script

The `run-migrations.sh` script handles database creation and migration execution:

```bash
cd glassflow-api/migrations

# Set environment variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your_password
export POSTGRES_DB=glassflow
export POSTGRES_ADMIN_DB=postgres

# Run migrations
./run-migrations.sh
```

### Using golang-migrate Directly

If you prefer to use `migrate` directly:

```bash
# Create database first (if it doesn't exist)
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE glassflow;"

# Run migrations
migrate -path file://$(pwd) -database "postgres://postgres:password@localhost:5432/glassflow?sslmode=disable" up

# Check migration version
migrate -path file://$(pwd) -database "postgres://postgres:password@localhost:5432/glassflow?sslmode=disable" version

# Rollback (if needed)
migrate -path file://$(pwd) -database "postgres://postgres:password@localhost:5432/glassflow?sslmode=disable" down 1
```

## Database Name

The default database name is `glassflow`. This can be changed via the `POSTGRES_DB` environment variable.

## Migration Workflow

1. **Create a new migration**:
   ```bash
   migrate create -ext sql -dir migrations -seq <migration_name>
   ```
   This creates two files: `XXXXX_<migration_name>.up.sql` and `XXXXX_<migration_name>.down.sql`

2. **Write the migration SQL** in the `.up.sql` file

3. **Write the rollback SQL** in the `.down.sql` file

4. **Test locally** using the migration script

5. **Commit and push** to the repository

6. **Kubernetes will automatically run migrations** via the migration Job (see Helm chart)

## Kubernetes Deployment

Migrations are automatically run in Kubernetes via a Job that:
1. Clones the repository
2. Creates the database if it doesn't exist
3. Runs all pending migrations
4. Waits for Postgres to be ready before starting

See the Helm chart templates for the migration Job configuration.

