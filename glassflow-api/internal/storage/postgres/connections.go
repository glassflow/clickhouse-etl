package postgres

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/encryption"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// insertConnectionWithConfig inserts a connection with the given config
func (s *PostgresStorage) insertConnectionWithConfig(ctx context.Context, tx pgx.Tx, connType string, connConfig []byte) (uuid.UUID, error) {
	configToStore := connConfig

	if s.encryptionService != nil {
		var err error
		configToStore, err = encryptSensitiveFields(s.encryptionService, connType, connConfig)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to encrypt sensitive fields",
				slog.String("connection_type", connType),
				slog.String("error", err.Error()))
			return uuid.Nil, fmt.Errorf("encrypt sensitive fields: %w", err)
		}
	}

	var connID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO connections (type, config)
		VALUES ($1, $2)
		RETURNING id
	`, connType, configToStore).Scan(&connID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to insert connection",
			slog.String("connection_type", connType),
			slog.String("error", err.Error()))
		return uuid.Nil, fmt.Errorf("insert connection: %w", err)
	}

	return connID, nil
}

// updateConnectionWithConfig updates an existing connection with the given config
func (s *PostgresStorage) updateConnectionWithConfig(ctx context.Context, tx pgx.Tx, connID uuid.UUID, connType string, connConfig []byte) error {

	configToStore := connConfig

	if s.encryptionService != nil {
		var err error
		configToStore, err = encryptSensitiveFields(s.encryptionService, connType, connConfig)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to encrypt sensitive fields",
				slog.String("connection_id", connID.String()),
				slog.String("error", err.Error()))
			return fmt.Errorf("encrypt sensitive fields: %w", err)
		}
	}

	_, err := tx.Exec(ctx, `
		UPDATE connections
		SET config = $1, updated_at = NOW()
		WHERE id = $2
	`, configToStore, connID)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to update connection",
			slog.String("connection_id", connID.String()),
			slog.String("error", err.Error()))
		return fmt.Errorf("update connection: %w", err)
	}

	return nil
}

// encryptSensitiveFields encrypts sensitive fields in the connection config JSON
func encryptSensitiveFields(encryptionService *encryption.Service, connType string, configJSON []byte) ([]byte, error) {
	if encryptionService == nil {
		return configJSON, nil
	}

	switch connType {
	case "kafka":
		var config models.IngestorComponentConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("unmarshal kafka config: %w", err)
		}
		if err := encryptKafkaFields(encryptionService, &config); err != nil {
			return nil, err
		}
		return json.Marshal(config)
	case "clickhouse":
		var config models.SinkComponentConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("unmarshal clickhouse config: %w", err)
		}
		if err := encryptClickHouseFields(encryptionService, &config); err != nil {
			return nil, err
		}
		return json.Marshal(config)
	default:
		return configJSON, nil
	}
}

// decryptSensitiveFields decrypts sensitive fields in the connection config JSON
func decryptSensitiveFields(encryptionService *encryption.Service, connType string, configJSON []byte) ([]byte, error) {
	if encryptionService == nil {
		return configJSON, nil
	}

	switch connType {
	case "kafka":
		var config models.IngestorComponentConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("unmarshal kafka config: %w", err)
		}
		if err := decryptKafkaFields(encryptionService, &config); err != nil {
			return nil, err
		}
		return json.Marshal(config)
	case "clickhouse":
		var config models.SinkComponentConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("unmarshal clickhouse config: %w", err)
		}
		if err := decryptClickHouseFields(encryptionService, &config); err != nil {
			return nil, err
		}
		return json.Marshal(config)
	default:
		return configJSON, nil
	}
}

// encryptKafkaFields encrypts sensitive fields in Kafka connection config
func encryptKafkaFields(encryptionService *encryption.Service, config *models.IngestorComponentConfig) error {
	// Encrypt password
	if config.KafkaConnectionParams.SASLPassword != "" {
		encrypted, err := encryptionService.Encrypt([]byte(config.KafkaConnectionParams.SASLPassword))
		if err != nil {
			return fmt.Errorf("encrypt password: %w", err)
		}
		config.KafkaConnectionParams.SASLPassword = base64.StdEncoding.EncodeToString(encrypted)
	}

	// Encrypt TLS key
	if config.KafkaConnectionParams.TLSKey != "" {
		encrypted, err := encryptionService.Encrypt([]byte(config.KafkaConnectionParams.TLSKey))
		if err != nil {
			return fmt.Errorf("encrypt tls_key: %w", err)
		}
		config.KafkaConnectionParams.TLSKey = base64.StdEncoding.EncodeToString(encrypted)
	}

	// Encrypt Kerberos keytab
	if config.KafkaConnectionParams.KerberosKeytab != "" {
		encrypted, err := encryptionService.Encrypt([]byte(config.KafkaConnectionParams.KerberosKeytab))
		if err != nil {
			return fmt.Errorf("encrypt kerberos_keytab: %w", err)
		}
		config.KafkaConnectionParams.KerberosKeytab = base64.StdEncoding.EncodeToString(encrypted)
	}

	return nil
}

// encryptClickHouseFields encrypts sensitive fields in ClickHouse connection config
func encryptClickHouseFields(encryptionService *encryption.Service, config *models.SinkComponentConfig) error {
	// Encrypt password
	if config.ClickHouseConnectionParams.Password != "" {
		encrypted, err := encryptionService.Encrypt([]byte(config.ClickHouseConnectionParams.Password))
		if err != nil {
			return fmt.Errorf("encrypt password: %w", err)
		}
		// TODO KIRAN DEBUG - remove this
		fmt.Println(string(encrypted))
		config.ClickHouseConnectionParams.Password = base64.StdEncoding.EncodeToString(encrypted)
	}

	return nil
}

// decryptKafkaFields decrypts sensitive fields in Kafka connection config
func decryptKafkaFields(encryptionService *encryption.Service, config *models.IngestorComponentConfig) error {
	// Decrypt password - try to decrypt if it looks like base64-encoded encrypted data
	if config.KafkaConnectionParams.SASLPassword != "" {
		if decrypted, err := attemptDecryptField(encryptionService, config.KafkaConnectionParams.SASLPassword); err == nil {
			config.KafkaConnectionParams.SASLPassword = decrypted
		}
		// If decryption fails, assume it's plaintext (backward compatibility)
	}

	// Decrypt TLS key
	if config.KafkaConnectionParams.TLSKey != "" {
		if decrypted, err := attemptDecryptField(encryptionService, config.KafkaConnectionParams.TLSKey); err == nil {
			config.KafkaConnectionParams.TLSKey = decrypted
		}
	}

	// Decrypt Kerberos keytab
	if config.KafkaConnectionParams.KerberosKeytab != "" {
		if decrypted, err := attemptDecryptField(encryptionService, config.KafkaConnectionParams.KerberosKeytab); err == nil {
			config.KafkaConnectionParams.KerberosKeytab = decrypted
		}
	}

	return nil
}

// decryptClickHouseFields decrypts sensitive fields in ClickHouse connection config
func decryptClickHouseFields(encryptionService *encryption.Service, config *models.SinkComponentConfig) error {
	// Decrypt password
	if config.ClickHouseConnectionParams.Password != "" {
		if decrypted, err := attemptDecryptField(encryptionService, config.ClickHouseConnectionParams.Password); err == nil {
			config.ClickHouseConnectionParams.Password = decrypted
		}
		// If decryption fails, assume it's plaintext (backward compatibility)
	}

	return nil
}

// attemptDecryptField attempts to decrypt a field. Returns the decrypted value if successful,
// or an error if the field is not encrypted (plaintext). This allows us backward compatibility.
func attemptDecryptField(encryptionService *encryption.Service, fieldValue string) (string, error) {
	// Try to base64 decode
	encryptedBytes, err := base64.StdEncoding.DecodeString(fieldValue)
	if err != nil {
		// Not base64 encoded, must be plaintext
		return "", fmt.Errorf("not base64 encoded")
	}

	// Try to decrypt
	decrypted, err := encryptionService.Decrypt(encryptedBytes)
	if err != nil {
		// Decryption failed, might be plaintext that happens to be valid base64
		return "", fmt.Errorf("decryption failed")
	}

	return string(decrypted), nil
}
