package main

import (
	"fmt"
	"log/slog"
	"os"
)

func loadEncryptionKey(cfg *config, log *slog.Logger) ([]byte, error) {
	if cfg.EncryptionKey != "" {
		key := []byte(cfg.EncryptionKey)
		if len(key) != 32 {
			return nil, fmt.Errorf("encryption key must be exactly 32 bytes, got %d bytes", len(key))
		}
		log.Info("encryption key loaded from environment variable")
		return key, nil
	}

	if cfg.EncryptionKeyPath != "" {
		keyData, err := os.ReadFile(cfg.EncryptionKeyPath)
		if err != nil {
			if os.IsNotExist(err) {
				log.Info("encryption key file not found, encryption disabled",
					slog.String("path", cfg.EncryptionKeyPath))
				return nil, nil
			}
			return nil, fmt.Errorf("read encryption key file: %w", err)
		}

		key := keyData
		if len(key) == 0 {
			log.Info("encryption key file is empty, encryption disabled",
				slog.String("path", cfg.EncryptionKeyPath))
			return nil, nil
		}

		if len(key) != 32 {
			return nil, fmt.Errorf("encryption key must be exactly 32 bytes, got %d bytes", len(key))
		}

		log.Info("encryption key loaded from file",
			slog.String("path", cfg.EncryptionKeyPath))
		return key, nil
	}

	return nil, nil
}
