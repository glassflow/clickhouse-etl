package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/encryption"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStorage implements PipelineStore using PostgreSQL
type PostgresStorage struct {
	pool              *pgxpool.Pool
	logger            *slog.Logger
	encryptionService *encryption.Service
}

// NewPostgres creates a new PostgresStorage instance with retry logic
func NewPostgres(ctx context.Context, dsn string, logger *slog.Logger, encryptionKey []byte) (*PostgresStorage, error) {
	if logger == nil {
		logger = slog.Default()
	}

	connCtx, cancel := context.WithTimeout(ctx, internal.PostgresMaxConnectionWait)
	defer cancel()

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

	var pool *pgxpool.Pool

	err = retry.Do(
		func() error {
			// Create connection pool with timeout context
			poolCtx, poolCancel := context.WithTimeout(connCtx, internal.PostgresConnectionTimeout)
			newPool, poolErr := pgxpool.NewWithConfig(poolCtx, config)
			poolCancel()

			if poolErr != nil {
				return poolErr
			}

			// Test connection with ping
			pingCtx, pingCancel := context.WithTimeout(connCtx, internal.PostgresConnectionTimeout)
			pingErr := newPool.Ping(pingCtx)
			pingCancel()

			if pingErr != nil {
				// Ping failed, close pool and retry
				newPool.Close()
				return pingErr
			}

			// Successfully connected and pinged
			pool = newPool
			return nil
		},
		retry.Attempts(internal.PostgresConnectionRetries),
		retry.Delay(internal.PostgresInitialRetryDelay),
		retry.MaxDelay(internal.PostgresMaxRetryDelay),
		retry.DelayType(retry.BackOffDelay),
		retry.Context(connCtx),
		retry.OnRetry(func(n uint, err error) {
			logger.InfoContext(ctx, "retrying postgres connection",
				slog.Int("attempt", int(n+1)),
				slog.Int("max_attempts", internal.PostgresConnectionRetries),
				slog.String("error", err.Error()))
		}),
	)

	if err != nil {
		logger.ErrorContext(ctx, "failed to connect to postgres after retries",
			slog.Int("max_attempts", internal.PostgresConnectionRetries),
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to connect to Postgres after %d attempts: %w", internal.PostgresConnectionRetries, err)
	}

	logger.InfoContext(ctx, "postgres connection established",
		slog.Int("max_conns", 25),
		slog.Int("min_conns", 5))

	var encService *encryption.Service
	if len(encryptionKey) > 0 {
		var err error
		encService, err = encryption.NewService(encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("initialize encryption service: %w", err)
		}
		logger.InfoContext(ctx, "encryption enabled for connection credentials")
	}

	return &PostgresStorage{
		pool:              pool,
		logger:            logger,
		encryptionService: encService,
	}, nil
}

// Close closes the database connection pool
func (s *PostgresStorage) Close() error {
	s.pool.Close()
	return nil
}
