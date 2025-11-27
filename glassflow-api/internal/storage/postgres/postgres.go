package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // PostgreSQL driver
)

// PostgresStorage implements PipelineStore using PostgreSQL
type PostgresStorage struct {
	db     *sql.DB
	logger *slog.Logger
}

// NewPostgres creates a new PostgresStorage instance
func NewPostgres(ctx context.Context, dsn string, logger *slog.Logger) (*PostgresStorage, error) {
	if logger == nil {
		logger = slog.Default()
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		logger.ErrorContext(ctx, "failed to open postgres connection",
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("open postgres connection: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		logger.ErrorContext(ctx, "failed to ping postgres",
			slog.String("error", err.Error()))
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	logger.InfoContext(ctx, "postgres connection established",
		slog.Int("max_open_conns", 25),
		slog.Int("max_idle_conns", 5))

	return &PostgresStorage{db: db, logger: logger}, nil
}

// Close closes the database connection
func (s *PostgresStorage) Close() error {
	return s.db.Close()
}
