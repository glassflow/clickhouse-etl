package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStorage implements PipelineStore using PostgreSQL
type PostgresStorage struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

// NewPostgres creates a new PostgresStorage instance with retry logic
func NewPostgres(ctx context.Context, dsn string, logger *slog.Logger) (*PostgresStorage, error) {
	if logger == nil {
		logger = slog.Default()
	}

	connCtx, cancel := context.WithTimeout(ctx, internal.PostgresMaxConnectionWait)
	defer cancel()

	retryDelay := internal.PostgresInitialRetryDelay
	var pool *pgxpool.Pool
	var err error

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		logger.ErrorContext(ctx, "failed to parse postgres config",
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}

	// Configure connection pool
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 5 * time.Minute

	// Retry connection pool creation and ping
	for i := range internal.PostgresConnectionRetries {
		select {
		case <-connCtx.Done():
			return nil, fmt.Errorf("timeout after %v waiting to connect to Postgres", internal.PostgresMaxConnectionWait)
		default:
		}

		// Create connection pool with timeout context
		poolCtx, poolCancel := context.WithTimeout(connCtx, internal.PostgresConnectionTimeout)
		pool, err = pgxpool.NewWithConfig(poolCtx, config)
		poolCancel()

		if err == nil {
			// Test connection with ping
			pingCtx, pingCancel := context.WithTimeout(connCtx, internal.PostgresConnectionTimeout)
			err = pool.Ping(pingCtx)
			pingCancel()

			if err == nil {
				// Successfully connected and pinged
				break
			}

			// Ping failed, close pool and retry
			pool.Close()
			pool = nil
		}

		// If this is not the last retry, wait before retrying
		if i < internal.PostgresConnectionRetries-1 {
			select {
			case <-time.After(retryDelay):
				logger.InfoContext(ctx, "retrying postgres connection",
					slog.Int("attempt", i+2),
					slog.Int("max_attempts", internal.PostgresConnectionRetries),
					slog.String("retry_delay", retryDelay.String()))
				// Continue with retry
			case <-connCtx.Done():
				return nil, fmt.Errorf("timeout during retry delay for Postgres: %w", connCtx.Err())
			}
			// Exponential backoff
			retryDelay = min(time.Duration(float64(retryDelay)*1.5), internal.PostgresMaxRetryDelay)
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "failed to connect to postgres after retries",
			slog.Int("max_attempts", internal.PostgresConnectionRetries),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to connect to Postgres after %d attempts: %w", internal.PostgresConnectionRetries, err)
	}

	logger.InfoContext(ctx, "postgres connection established",
		slog.Int("max_conns", 25),
		slog.Int("min_conns", 5))

	return &PostgresStorage{pool: pool, logger: logger}, nil
}

// Close closes the database connection pool
func (s *PostgresStorage) Close() error {
	s.pool.Close()
	return nil
}
