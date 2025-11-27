package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStorage implements PipelineStore using PostgreSQL
type PostgresStorage struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

// NewPostgres creates a new PostgresStorage instance
func NewPostgres(ctx context.Context, dsn string, logger *slog.Logger) (*PostgresStorage, error) {
	if logger == nil {
		logger = slog.Default()
	}

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

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create postgres connection pool",
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("create postgres connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		logger.ErrorContext(ctx, "failed to ping postgres",
			slog.String("error", err.Error()))
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
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
