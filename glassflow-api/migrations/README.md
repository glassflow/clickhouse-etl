# Database Migrations

This directory contains database migration files for the GlassFlow ETL PostgreSQL database.

## Migration Files

- `000001_initial_schema.up.sql` - Creates the initial database schema
- `000001_initial_schema.down.sql` - Rollback script (currently empty)
- `000002_add_stateless_transformation_type.up.sql` - Adds stateless transformation type
- `000002_add_stateless_transformation_type.down.sql` - Rollback script

**Note**: Only `.up.sql` files are included in the migration container. Down migrations are kept for rollback purposes.

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

Migrations are automatically run in Kubernetes via an initContainer that uses the `glassflow-etl-migration` container image.

### Migration Container

The migration container (`glassflow-etl-migration`) includes:
- Pre-installed `golang-migrate` (v4.19.1)
- Pre-installed `postgresql-client` (for connection testing)
- All migration SQL files (`.up.sql` files only)

The container image is built as part of the CI/CD pipeline and uses the same version tag as the API image to ensure compatibility.

### How It Works

1. The migration initContainer runs before the API container starts
2. It receives `POSTGRES_CONNECTION_URL` as an environment variable (includes SSL mode)
3. It attempts to connect to the database directly
4. If connection fails, it exits with an error (database should already exist - created by PostgreSQL chart or pre-created for external postgres)
5. If connection succeeds, it runs all pending migrations using `golang-migrate`
6. The API container starts only after migrations complete successfully

### Connection URL

The connection URL is automatically configured:
- **Internal PostgreSQL** (when `postgresql.enabled: true`): Retrieved from `glassflow-postgresql` secret, includes SSL mode
- **External PostgreSQL**: Provided via `global.postgres.connection_url` or `global.postgres.secret.name`

The connection URL format: `postgresql://username:password@host:port/database?sslmode={sslmode=disable|allow|prefer|require}`

### Database Creation

- **Internal PostgreSQL**: The database is automatically created by the PostgreSQL chart via the `POSTGRES_DB` environment variable (official postgres image behavior)
- **External PostgreSQL**: The database must be pre-created before running migrations

See the Helm chart templates (`charts/charts/glassflow-etl/templates/deployment.yaml`) for the migration initContainer configuration.

