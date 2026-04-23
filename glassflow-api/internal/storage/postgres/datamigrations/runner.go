package datamigrations

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	statusApplied = "applied"
	statusFailed  = "failed"
)

// Migration is a versioned data migration. Version must be unique and Registry
// entries must never be reordered or removed — only appended.
type Migration struct {
	Version string
	Name    string
	Up      func(ctx context.Context, tx pgx.Tx) error
}

// Run executes all pending migrations in registry order. Per-migration errors
// are recorded in data_migrations with status='failed' and logged — they do not
// prevent subsequent migrations or the API from starting. Failed migrations are
// retried on the next deployment.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	applied, err := loadApplied(ctx, pool)
	if err != nil {
		return err
	}

	for _, m := range Registry {
		if applied[m.Version] {
			continue
		}

		if err := runOne(ctx, pool, m); err != nil {
			slog.ErrorContext(ctx, "data migration failed — skipping, will retry on next deploy",
				"version", m.Version,
				"name", m.Name,
				"error", err.Error(),
			)
			if recordErr := recordFailure(ctx, pool, m, err); recordErr != nil {
				slog.ErrorContext(ctx, "failed to record migration failure",
					"version", m.Version,
					"error", recordErr.Error(),
				)
			}
			continue
		}

		slog.InfoContext(ctx, "data migration applied", "version", m.Version, "name", m.Name)
	}

	return nil
}

func runOne(ctx context.Context, pool *pgxpool.Pool, m Migration) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := m.Up(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO data_migrations (version, name, status)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (version) DO UPDATE SET status = $3, error = NULL, applied_at = NOW()`,
		m.Version, m.Name, statusApplied,
	); err != nil {
		return fmt.Errorf("record migration: %w", err)
	}

	return tx.Commit(ctx)
}

func recordFailure(ctx context.Context, pool *pgxpool.Pool, m Migration, migErr error) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO data_migrations (version, name, status, error)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (version) DO UPDATE SET status = $3, error = $4, applied_at = NOW()`,
		m.Version, m.Name, statusFailed, migErr.Error(),
	)
	return err
}

// loadApplied returns the set of migration versions that completed successfully.
// Failed entries are excluded so they are retried on the next run.
func loadApplied(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx,
		`SELECT version FROM data_migrations WHERE status = $1`, statusApplied,
	)
	if err != nil {
		return nil, fmt.Errorf("query data_migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, fmt.Errorf("scan version: %w", err)
		}
		applied[v] = true
	}

	return applied, rows.Err()
}
