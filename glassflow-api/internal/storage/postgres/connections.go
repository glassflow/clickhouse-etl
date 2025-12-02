package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// insertConnectionWithConfig inserts a connection with the given config
func (s *PostgresStorage) insertConnectionWithConfig(ctx context.Context, tx pgx.Tx, connType string, config []byte) (uuid.UUID, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal connection config",
			slog.String("connection_type", connType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("marshal connection config: %w", err)
	}

	var connID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO connections (type, config)
		VALUES ($1, $2)
		RETURNING id
	`, connType, configJSON).Scan(&connID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert connection",
			slog.String("connection_type", connType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert connection: %w", err)
	}

	return connID, nil
}

// updateConnectionWithConfig updates an existing connection with the given config
func (s *PostgresStorage) updateConnectionWithConfig(ctx context.Context, tx pgx.Tx, connID uuid.UUID, config []byte) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to marshal connection config",
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("marshal connection config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE connections
		SET config = $1, updated_at = NOW()
		WHERE id = $2
	`, configJSON, connID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update connection",
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update connection: %w", err)
	}

	return nil
}
