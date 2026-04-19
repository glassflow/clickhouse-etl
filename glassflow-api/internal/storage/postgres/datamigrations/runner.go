package datamigrations

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Migration is a versioned data migration. Version must be unique and Registry
// entries must never be reordered or removed — only appended.
type Migration struct {
	Version string
	Name    string
	Up      func(ctx context.Context, tx pgx.Tx) error
}

// Run executes all pending migrations in registry order. Each migration and its
// tracking record commit atomically; a failure leaves no tracking row so the
// migration re-runs cleanly on the next attempt.
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
			return fmt.Errorf("data migration %s (%s): %w", m.Version, m.Name, err)
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
		`INSERT INTO data_migrations (version, name) VALUES ($1, $2)`,
		m.Version, m.Name,
	); err != nil {
		return fmt.Errorf("record migration: %w", err)
	}

	return tx.Commit(ctx)
}

func loadApplied(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, `SELECT version FROM data_migrations`)
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
